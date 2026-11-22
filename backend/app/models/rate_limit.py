from sqlalchemy import BigInteger, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RateLimitHit(Base):
    """One fixed-window counter shared by every worker and replica (RATE_LIMIT_BACKEND=database).

    `bucket` is "<limiter>:<sha256 of the key>"; raw client addresses are never stored.
    """

    __tablename__ = "rate_limit_hits"
    __table_args__ = (Index("ix_rate_limit_hits_window_start", "window_start"),)

    bucket: Mapped[str] = mapped_column(String(80), primary_key=True)
    window_start: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    count: Mapped[int] = mapped_column(Integer, nullable=False)
