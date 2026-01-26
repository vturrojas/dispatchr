import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship

from app.db.base import Base


def utcnow() -> datetime:
    # timezone-aware UTC timestamp
    return datetime.now(timezone.utc)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    type: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="queued")

    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )
    run_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)

    last_error: Mapped[str | None] = mapped_column(String, nullable=True)

    events = relationship(
        "JobEvent",
        back_populates="job",
        cascade="all, delete-orphan",
    )


class JobEvent(Base):
    __tablename__ = "job_events"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    job_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    event: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str | None] = mapped_column(String, nullable=True)
    data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        nullable=False,
    )

    job = relationship("Job", back_populates="events")
