from fastapi import APIRouter, Depends

from app.api.deps import verify_origin
from app.api.v1.routes import auth, health, invitations, public, users, weddings

api_router = APIRouter(dependencies=[Depends(verify_origin)])
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(invitations.router)
# Legacy `/weddings/me` must be registered before `/weddings/{invitation_id}`.
api_router.include_router(weddings.router)
api_router.include_router(invitations.item_router, prefix="/invitations", tags=["invitations"])
api_router.include_router(
    invitations.item_router, prefix="/weddings", tags=["weddings (legacy)"], deprecated=True
)
# Guest-facing, unauthenticated (the RSVP POST passes the Origin check like any browser POST).
api_router.include_router(public.router)
