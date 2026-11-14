from sqlalchemy.orm import Session

from app.models import User
from app.schemas.user import UserUpdate


def update_profile(db: Session, user: User, changes: UserUpdate) -> User:
    if changes.full_name is not None:
        user.full_name = changes.full_name
    db.commit()
    db.refresh(user)
    return user
