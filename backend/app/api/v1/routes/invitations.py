"""Invitation CMS routes (contract: docs/api/invitations.md).

`router` holds the collection-level routes (`/invitation-types`, `/invitations`).
`item_router` holds every per-invitation route; it is mounted twice, under
`/invitations` and under the legacy `/weddings` prefix, so both paths run the same
handlers. Every item route requires a session; `OwnedInvitation` turns any id that is
missing, malformed or owned by someone else into 404. Content responses are dicts
built by the content/collection services; `response_model_exclude_unset` keeps keys
that are not set out of the JSON.
"""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, File, Form, Query, Response, UploadFile, status
from fastapi.responses import JSONResponse

from app.api.deps import AppSettings, CurrentUser, DbSession, OwnedInvitation, WritableInvitation
from app.core import invitation_registry
from app.schemas.invitation import (
    PublishCheckOut,
    SECTION_MODELS,
    SECTION_OUT_MODELS,
    UNIVERSAL_SECTION_MODELS,
    UNIVERSAL_SECTION_OUT_MODELS,
    AssetOut,
    EventIn,
    EventOut,
    GalleryItemIn,
    GalleryItemOut,
    InvitationCreate,
    InvitationDraftIn,
    InvitationDraftOut,
    InvitationList,
    InvitationRead,
    InvitationUpdate,
    PreviewOut,
    ReorderRequest,
    RequestModel,
    StoryEntryIn,
    StoryEntryOut,
)
from app.schemas.rsvp import RsvpResponseList
from app.services import (
    invitation_collection_service,
    invitation_content_service,
    invitation_publish_service,
    invitation_service,
    media_service,
    rsvp_service,
)

router = APIRouter(tags=["invitations"])
item_router = APIRouter()

_CONTENT = {"response_model_exclude_unset": True}
_PRIVATE = {"Cache-Control": "no-store"}


def _tag(response: Response, invitation: Any, db: Any) -> None:
    """Expose the content revision as an ETag, for the client's next `If-Match`.

    Re-read from the database: writes bump it with a SQL expression, and sessions
    don't expire attributes on commit.
    """
    db.refresh(invitation, attribute_names=["revision"])
    response.headers["ETag"] = f'"{invitation.revision}"'


def read_model(db: Any, invitation: Any) -> InvitationRead:
    """`InvitationRead` from fresh state (revision is bumped in SQL; the live publication may
    have just changed)."""
    db.refresh(invitation)
    db.expire(invitation, ["publication"])
    return InvitationRead.model_validate(invitation)


# --- Registry and collection --------------------------------------------------------------


@router.get("/invitation-types")
def read_invitation_types() -> JSONResponse:
    """Categories, variants, per-variant sections and presets, and template compatibility.
    Public (no session needed) and cacheable."""
    return JSONResponse(
        invitation_registry.public_document(), headers={"Cache-Control": "public, max-age=300"}
    )


@router.get("/invitations", response_model=InvitationList)
def list_invitations(user: CurrentUser, db: DbSession) -> Any:
    return {"items": [invitation_service.summary(i) for i in invitation_service.list_invitations(db, user)]}


@router.post("/invitations", response_model=InvitationRead, status_code=status.HTTP_201_CREATED)
def create_invitation(payload: InvitationCreate, user: CurrentUser, db: DbSession) -> InvitationRead:
    invitation = invitation_service.create_invitation(
        db, user, category=payload.category, variant=payload.variant, theme_id=payload.theme_id,
        title=payload.title, locale=payload.locale, timezone=payload.timezone,
        sessions=None if payload.sessions is None else [(s.type, s.title) for s in payload.sessions],
    )
    return read_model(db, invitation)


# --- Invitation record --------------------------------------------------------------------


@item_router.get("/{invitation_id}", response_model=InvitationRead)
def read_invitation(invitation: OwnedInvitation, db: DbSession) -> InvitationRead:
    return read_model(db, invitation)


@item_router.patch("/{invitation_id}", response_model=InvitationRead)
def update_invitation(payload: InvitationUpdate, invitation: OwnedInvitation, db: DbSession) -> InvitationRead:
    return read_model(db, invitation_service.update_invitation(db, invitation, payload))


@item_router.delete("/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_invitation(invitation: OwnedInvitation, db: DbSession) -> Response:
    invitation_service.delete_invitation(db, invitation)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Publishing ---------------------------------------------------------------------------


@item_router.post("/{invitation_id}/publish", response_model=InvitationRead)
def publish_invitation(invitation: WritableInvitation, db: DbSession, response: Response) -> InvitationRead:
    """Validate and snapshot the current draft; 422 `publish_blocked` lists what is missing."""
    invitation_publish_service.publish(db, invitation)
    _tag(response, invitation, db)
    return read_model(db, invitation)


@item_router.get("/{invitation_id}/publish-check", response_model=PublishCheckOut)
def check_publish(invitation: OwnedInvitation, db: DbSession) -> dict[str, Any]:
    """Dry run of publishing: the blocking issues `POST .../publish` would return now, with
    the content revision they were computed for. Nothing is changed."""
    issues = invitation_publish_service.check(db, invitation)
    return {"revision": invitation.revision, "ready": not issues, "issues": issues}


@item_router.post("/{invitation_id}/unpublish", response_model=InvitationRead)
def unpublish_invitation(invitation: WritableInvitation, db: DbSession, response: Response) -> InvitationRead:
    invitation_publish_service.unpublish(db, invitation)
    _tag(response, invitation, db)
    return read_model(db, invitation)


# --- Image uploads (not content writes: no If-Match, no revision bump) --------------------


@item_router.post("/{invitation_id}/assets", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def upload_asset(
    invitation: OwnedInvitation,
    db: DbSession,
    settings: AppSettings,
    file: Annotated[UploadFile, File()],
    kind: Annotated[Literal["image", "qris"], Form()],
) -> Any:
    data = media_service.read_limited(file.file, settings.max_upload_bytes)
    asset = media_service.create_asset(db, invitation, kind=kind, data=data)
    return media_service.asset_out(asset)


@item_router.delete(
    "/{invitation_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response
)
def delete_asset(asset_id: str, invitation: OwnedInvitation, db: DbSession) -> Response:
    media_service.delete_asset(db, invitation, asset_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Content ------------------------------------------------------------------------------


@item_router.get("/{invitation_id}/content", response_model=InvitationDraftOut, **_CONTENT)
def read_content(invitation: OwnedInvitation, db: DbSession, response: Response) -> Any:
    draft = invitation_content_service.assemble_draft(db, invitation)
    _tag(response, invitation, db)
    return draft


@item_router.put("/{invitation_id}/content", response_model=InvitationDraftOut, **_CONTENT)
def replace_content(payload: InvitationDraftIn, invitation: WritableInvitation, db: DbSession, response: Response) -> Any:
    draft = invitation_content_service.replace_content(db, invitation, payload)
    _tag(response, invitation, db)
    return draft


@item_router.get("/{invitation_id}/preview", response_model=PreviewOut, **_CONTENT)
def read_preview(invitation: OwnedInvitation, db: DbSession) -> Any:
    return invitation_content_service.build_preview(db, invitation)


# --- Sections (one explicit route pair per section; unknown sections 404) ----------------


def _register_section(section: str, body_model: type[RequestModel], out_model: type) -> None:
    def read_section(invitation: OwnedInvitation, db: DbSession, response: Response) -> Any:
        _tag(response, invitation, db)
        return invitation_content_service.get_section(invitation, section)  # type: ignore[arg-type]

    def put_section(payload: body_model, invitation: WritableInvitation, db: DbSession, response: Response) -> Any:  # type: ignore[valid-type]
        out = invitation_content_service.put_section(db, invitation, section, payload)  # type: ignore[arg-type]
        _tag(response, invitation, db)
        return out

    path = f"/{{invitation_id}}/sections/{section}"
    item_router.add_api_route(
        path, read_section, methods=["GET"], response_model=out_model,
        name=f"read_{section}_section", **_CONTENT,
    )
    item_router.add_api_route(
        path, put_section, methods=["PUT"], response_model=out_model,
        name=f"put_{section}_section", **_CONTENT,
    )


for _section, _model in SECTION_MODELS.items():
    _register_section(_section, _model, SECTION_OUT_MODELS[_section])


def _register_universal_section(section: str, body_model: type[RequestModel], out_model: type) -> None:
    """v1.1+ sections (`/sections/holyRecite1`, …): replace semantics, same If-Match rules."""

    def read_section(invitation: OwnedInvitation, db: DbSession, response: Response) -> Any:
        _tag(response, invitation, db)
        return invitation_content_service.get_universal_section(invitation, section)

    def put_section(payload: body_model, invitation: WritableInvitation, db: DbSession, response: Response) -> Any:  # type: ignore[valid-type]
        out = invitation_content_service.put_universal_section(db, invitation, section, payload)
        _tag(response, invitation, db)
        return out

    path = f"/{{invitation_id}}/sections/{section}"
    item_router.add_api_route(
        path, read_section, methods=["GET"], response_model=out_model,
        name=f"read_{section}_section", **_CONTENT,
    )
    item_router.add_api_route(
        path, put_section, methods=["PUT"], response_model=out_model,
        name=f"put_{section}_section", **_CONTENT,
    )


for _section, _model in UNIVERSAL_SECTION_MODELS.items():
    _register_universal_section(_section, _model, UNIVERSAL_SECTION_OUT_MODELS[_section])


# --- Collections --------------------------------------------------------------------------


def _register_collection(collection: str, body_model: type[RequestModel], out_model: type) -> None:
    service = invitation_collection_service
    base = f"/{{invitation_id}}/{collection}"

    def list_items(invitation: OwnedInvitation, db: DbSession, response: Response) -> Any:
        _tag(response, invitation, db)
        return service.list_items(db, invitation, collection)  # type: ignore[arg-type]

    def create_item(payload: body_model, invitation: WritableInvitation, db: DbSession, response: Response) -> Any:  # type: ignore[valid-type]
        out = service.create_item(db, invitation, collection, item=payload)  # type: ignore[arg-type]
        _tag(response, invitation, db)
        return out

    def reorder_items(payload: ReorderRequest, invitation: WritableInvitation, db: DbSession, response: Response) -> Any:
        out = service.reorder_items(db, invitation, collection, ids=payload.ids)  # type: ignore[arg-type]
        _tag(response, invitation, db)
        return out

    def update_item(item_id: str, payload: body_model, invitation: WritableInvitation, db: DbSession, response: Response) -> Any:  # type: ignore[valid-type]
        out = service.update_item(db, invitation, collection, item_id, item=payload)  # type: ignore[arg-type]
        _tag(response, invitation, db)
        return out

    def delete_item(item_id: str, invitation: WritableInvitation, db: DbSession) -> Response:
        service.delete_item(db, invitation, collection, item_id)  # type: ignore[arg-type]
        response = Response(status_code=status.HTTP_204_NO_CONTENT)
        _tag(response, invitation, db)
        return response

    item_router.add_api_route(
        base, list_items, methods=["GET"], response_model=list[out_model],
        name=f"list_{collection}", **_CONTENT,
    )
    item_router.add_api_route(
        base, create_item, methods=["POST"], response_model=out_model,
        status_code=status.HTTP_201_CREATED, name=f"create_{collection}_item", **_CONTENT,
    )
    # `/order` must be registered before `/{item_id}` so it is not captured as an id.
    item_router.add_api_route(
        f"{base}/order", reorder_items, methods=["PUT"], response_model=list[out_model],
        name=f"reorder_{collection}", **_CONTENT,
    )
    item_router.add_api_route(
        f"{base}/{{item_id}}", update_item, methods=["PUT"], response_model=out_model,
        name=f"update_{collection}_item", **_CONTENT,
    )
    item_router.add_api_route(
        f"{base}/{{item_id}}", delete_item, methods=["DELETE"],
        status_code=status.HTTP_204_NO_CONTENT, response_class=Response,
        name=f"delete_{collection}_item",
    )


_register_collection("stories", StoryEntryIn, StoryEntryOut)
_register_collection("events", EventIn, EventOut)
_register_collection("gallery", GalleryItemIn, GalleryItemOut)


# --- RSVP replies (owner only; guest PII: never cached, never logged) ---------------------


@item_router.get("/{invitation_id}/rsvp-responses", response_model=RsvpResponseList, **_CONTENT)
def list_rsvp_responses(
    invitation: OwnedInvitation,
    db: DbSession,
    response: Response,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0, le=1_000_000)] = 0,
) -> Any:
    response.headers.update(_PRIVATE)
    return rsvp_service.list_responses(db, invitation, limit=limit, offset=offset)


@item_router.get(
    "/{invitation_id}/rsvp-responses.csv",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}, "description": "All replies as CSV"}},
)
def export_rsvp_responses(invitation: OwnedInvitation, db: DbSession) -> Response:
    name = f"rsvp-{invitation.slug or invitation.id}.csv"
    return Response(
        rsvp_service.export_csv(db, invitation).encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={**_PRIVATE, "Content-Disposition": f'attachment; filename="{name}"',
                 "X-Content-Type-Options": "nosniff"},
    )


@item_router.delete(
    "/{invitation_id}/rsvp-responses/{response_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response
)
def delete_rsvp_response(response_id: str, invitation: OwnedInvitation, db: DbSession) -> Response:
    rsvp_service.delete_response(db, invitation, response_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
