"""Wedding CMS routes (contract: docs/api/weddings.md).

Every route requires a session; `OwnedWedding` turns any id that is missing,
malformed or owned by someone else into 404. Content responses are dicts built
by the content/collection services; `response_model_exclude_unset` keeps keys
that are not set out of the JSON.
"""

from typing import Any

from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DbSession, OwnedWedding, WritableWedding
from app.schemas.wedding import (
    SECTION_MODELS,
    SECTION_OUT_MODELS,
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
from app.services import wedding_collection_service, wedding_content_service, wedding_service

router = APIRouter(prefix="/weddings", tags=["weddings"])

_CONTENT = {"response_model_exclude_unset": True}


def _tag(response: Response, wedding: Any, db: Any) -> None:
    """Expose the content revision as an ETag, for the client's next `If-Match`.

    Re-read from the database: writes bump it with a SQL expression, and sessions
    don't expire attributes on commit.
    """
    db.refresh(wedding, attribute_names=["revision"])
    response.headers["ETag"] = f'"{wedding.revision}"'


# --- Wedding record -----------------------------------------------------------------------


@router.get("/me", response_model=WeddingRead)
def read_my_wedding(user: CurrentUser, db: DbSession) -> WeddingRead:
    return WeddingRead.model_validate(wedding_service.get_my_wedding(db, user))


@router.post("", response_model=WeddingRead, status_code=status.HTTP_201_CREATED)
def create_wedding(payload: WeddingCreate, user: CurrentUser, db: DbSession) -> WeddingRead:
    wedding = wedding_service.create_wedding(db, user, theme_id=payload.theme_id, locale=payload.locale)
    return WeddingRead.model_validate(wedding)


@router.patch("/{wedding_id}", response_model=WeddingRead)
def update_wedding(payload: WeddingUpdate, wedding: OwnedWedding, db: DbSession) -> WeddingRead:
    return WeddingRead.model_validate(wedding_service.update_wedding(db, wedding, payload))


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
