"""Wedding CMS routes (contract: docs/api/weddings.md).

Every route requires a session; `OwnedWedding` turns any id that is missing,
malformed or owned by someone else into 404. Content responses are dicts built
by the content/collection services; `response_model_exclude_unset` keeps keys
that are not set out of the JSON.
"""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, File, Form, Response, UploadFile, status

from app.api.deps import AppSettings, CurrentUser, DbSession, OwnedWedding, WritableWedding
from app.schemas.wedding import (
    AssetOut,
    SECTION_MODELS,
    SECTION_OUT_MODELS,
    UNIVERSAL_SECTION_MODELS,
    UNIVERSAL_SECTION_OUT_MODELS,
    EventIn,
    EventOut,
    GalleryItemIn,
    GalleryItemOut,
    PreviewOut,
    ReorderRequest,
    RequestModel,
    StoryEntryIn,
    StoryEntryOut,
    WeddingCreate,
    WeddingDraftIn,
    WeddingDraftOut,
    WeddingRead,
    WeddingUpdate,
)
from app.services import (
    media_service,
    wedding_collection_service,
    wedding_content_service,
    wedding_publish_service,
    wedding_service,
)

router = APIRouter(prefix="/weddings", tags=["weddings"])

_CONTENT = {"response_model_exclude_unset": True}


def _tag(response: Response, wedding: Any, db: Any) -> None:
    """Expose the content revision as an ETag, for the client's next `If-Match`.

    Re-read from the database: writes bump it with a SQL expression, and sessions
    don't expire attributes on commit.
    """
    db.refresh(wedding, attribute_names=["revision"])
    response.headers["ETag"] = f'"{wedding.revision}"'


def _read(db: Any, wedding: Any) -> WeddingRead:
    """`WeddingRead` from fresh state (revision is bumped in SQL; the live publication may
    have just changed)."""
    db.refresh(wedding)
    db.expire(wedding, ["publication"])
    return WeddingRead.model_validate(wedding)


# --- Wedding record -----------------------------------------------------------------------


@router.get("/me", response_model=WeddingRead)
def read_my_wedding(user: CurrentUser, db: DbSession) -> WeddingRead:
    return _read(db, wedding_service.get_my_wedding(db, user))


@router.post("", response_model=WeddingRead, status_code=status.HTTP_201_CREATED)
def create_wedding(payload: WeddingCreate, user: CurrentUser, db: DbSession) -> WeddingRead:
    wedding = wedding_service.create_wedding(db, user, theme_id=payload.theme_id, locale=payload.locale)
    return _read(db, wedding)


@router.patch("/{wedding_id}", response_model=WeddingRead)
def update_wedding(payload: WeddingUpdate, wedding: OwnedWedding, db: DbSession) -> WeddingRead:
    return _read(db, wedding_service.update_wedding(db, wedding, payload))


# --- Publishing ---------------------------------------------------------------------------


@router.post("/{wedding_id}/publish", response_model=WeddingRead)
def publish_wedding(wedding: WritableWedding, db: DbSession, response: Response) -> WeddingRead:
    """Validate and snapshot the current draft; 422 `publish_blocked` lists what is missing."""
    wedding_publish_service.publish(db, wedding)
    _tag(response, wedding, db)
    return _read(db, wedding)


@router.post("/{wedding_id}/unpublish", response_model=WeddingRead)
def unpublish_wedding(wedding: WritableWedding, db: DbSession, response: Response) -> WeddingRead:
    wedding_publish_service.unpublish(db, wedding)
    _tag(response, wedding, db)
    return _read(db, wedding)


# --- Image uploads (not content writes: no If-Match, no revision bump) --------------------


@router.post("/{wedding_id}/assets", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def upload_asset(
    wedding: OwnedWedding,
    db: DbSession,
    settings: AppSettings,
    file: Annotated[UploadFile, File()],
    kind: Annotated[Literal["image", "qris"], Form()],
) -> Any:
    data = media_service.read_limited(file.file, settings.max_upload_bytes)
    asset = media_service.create_asset(db, wedding, kind=kind, data=data)
    return media_service.asset_out(asset)


@router.delete(
    "/{wedding_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response
)
def delete_asset(asset_id: str, wedding: OwnedWedding, db: DbSession) -> Response:
    media_service.delete_asset(db, wedding, asset_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Content ------------------------------------------------------------------------------


@router.get("/{wedding_id}/content", response_model=WeddingDraftOut, **_CONTENT)
def read_content(wedding: OwnedWedding, db: DbSession, response: Response) -> Any:
    draft = wedding_content_service.assemble_draft(db, wedding)
    _tag(response, wedding, db)
    return draft


@router.put("/{wedding_id}/content", response_model=WeddingDraftOut, **_CONTENT)
def replace_content(payload: WeddingDraftIn, wedding: WritableWedding, db: DbSession, response: Response) -> Any:
    draft = wedding_content_service.replace_content(db, wedding, payload)
    _tag(response, wedding, db)
    return draft


@router.get("/{wedding_id}/preview", response_model=PreviewOut, **_CONTENT)
def read_preview(wedding: OwnedWedding, db: DbSession) -> Any:
    return wedding_content_service.build_preview(db, wedding)


# --- Sections (one explicit route pair per section; unknown sections 404) ----------------


def _register_section(section: str, body_model: type[RequestModel], out_model: type) -> None:
    def read_section(wedding: OwnedWedding, db: DbSession, response: Response) -> Any:
        _tag(response, wedding, db)
        return wedding_content_service.get_section(wedding, section)  # type: ignore[arg-type]

    def put_section(payload: body_model, wedding: WritableWedding, db: DbSession, response: Response) -> Any:  # type: ignore[valid-type]
        out = wedding_content_service.put_section(db, wedding, section, payload)  # type: ignore[arg-type]
        _tag(response, wedding, db)
        return out

    path = f"/{{wedding_id}}/sections/{section}"
    router.add_api_route(
        path, read_section, methods=["GET"], response_model=out_model,
        name=f"read_{section}_section", **_CONTENT,
    )
    router.add_api_route(
        path, put_section, methods=["PUT"], response_model=out_model,
        name=f"put_{section}_section", **_CONTENT,
    )


for _section, _model in SECTION_MODELS.items():
    _register_section(_section, _model, SECTION_OUT_MODELS[_section])


def _register_universal_section(section: str, body_model: type[RequestModel], out_model: type) -> None:
    """v1.1+ sections (`/sections/holyRecite1`, …): replace semantics, same If-Match rules."""

    def read_section(wedding: OwnedWedding, db: DbSession, response: Response) -> Any:
        _tag(response, wedding, db)
        return wedding_content_service.get_universal_section(wedding, section)

    def put_section(payload: body_model, wedding: WritableWedding, db: DbSession, response: Response) -> Any:  # type: ignore[valid-type]
        out = wedding_content_service.put_universal_section(db, wedding, section, payload)
        _tag(response, wedding, db)
        return out

    path = f"/{{wedding_id}}/sections/{section}"
    router.add_api_route(
        path, read_section, methods=["GET"], response_model=out_model,
        name=f"read_{section}_section", **_CONTENT,
    )
    router.add_api_route(
        path, put_section, methods=["PUT"], response_model=out_model,
        name=f"put_{section}_section", **_CONTENT,
    )


for _section, _model in UNIVERSAL_SECTION_MODELS.items():
    _register_universal_section(_section, _model, UNIVERSAL_SECTION_OUT_MODELS[_section])


# --- Collections --------------------------------------------------------------------------


def _register_collection(collection: str, body_model: type[RequestModel], out_model: type) -> None:
    service = wedding_collection_service
    base = f"/{{wedding_id}}/{collection}"

    def list_items(wedding: OwnedWedding, db: DbSession, response: Response) -> Any:
        _tag(response, wedding, db)
        return service.list_items(db, wedding, collection)  # type: ignore[arg-type]

    def create_item(payload: body_model, wedding: WritableWedding, db: DbSession, response: Response) -> Any:  # type: ignore[valid-type]
        out = service.create_item(db, wedding, collection, item=payload)  # type: ignore[arg-type]
        _tag(response, wedding, db)
        return out

    def reorder_items(payload: ReorderRequest, wedding: WritableWedding, db: DbSession, response: Response) -> Any:
        out = service.reorder_items(db, wedding, collection, ids=payload.ids)  # type: ignore[arg-type]
        _tag(response, wedding, db)
        return out

    def update_item(item_id: str, payload: body_model, wedding: WritableWedding, db: DbSession, response: Response) -> Any:  # type: ignore[valid-type]
        out = service.update_item(db, wedding, collection, item_id, item=payload)  # type: ignore[arg-type]
        _tag(response, wedding, db)
        return out

    def delete_item(item_id: str, wedding: WritableWedding, db: DbSession) -> Response:
        service.delete_item(db, wedding, collection, item_id)  # type: ignore[arg-type]
        response = Response(status_code=status.HTTP_204_NO_CONTENT)
        _tag(response, wedding, db)
        return response

    router.add_api_route(
        base, list_items, methods=["GET"], response_model=list[out_model],
        name=f"list_{collection}", **_CONTENT,
    )
    router.add_api_route(
        base, create_item, methods=["POST"], response_model=out_model,
        status_code=status.HTTP_201_CREATED, name=f"create_{collection}_item", **_CONTENT,
    )
    # `/order` must be registered before `/{item_id}` so it is not captured as an id.
    router.add_api_route(
        f"{base}/order", reorder_items, methods=["PUT"], response_model=list[out_model],
        name=f"reorder_{collection}", **_CONTENT,
    )
    router.add_api_route(
        f"{base}/{{item_id}}", update_item, methods=["PUT"], response_model=out_model,
        name=f"update_{collection}_item", **_CONTENT,
    )
    router.add_api_route(
        f"{base}/{{item_id}}", delete_item, methods=["DELETE"],
        status_code=status.HTTP_204_NO_CONTENT, response_class=Response,
        name=f"delete_{collection}_item",
    )


_register_collection("stories", StoryEntryIn, StoryEntryOut)
_register_collection("events", EventIn, EventOut)
_register_collection("gallery", GalleryItemIn, GalleryItemOut)
