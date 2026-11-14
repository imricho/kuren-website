from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.user import UserRead, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
def read_me(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)


@router.patch("/me", response_model=UserRead)
def update_me(payload: UserUpdate, user: CurrentUser, db: DbSession) -> UserRead:
    # Authorization: a user can only ever modify their own profile here.
    return UserRead.model_validate(user_service.update_profile(db, user, payload))
