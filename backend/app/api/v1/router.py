from fastapi import APIRouter, Depends

from app.api.deps import verify_origin
from app.api.v1.routes import auth, health, users

api_router = APIRouter(dependencies=[Depends(verify_origin)])
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
