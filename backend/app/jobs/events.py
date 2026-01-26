from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import JobEvent


async def record_event(
    session: AsyncSession,
    job_id: str,
    event: str,
    message: str | None = None,
    data: dict[str, Any] | None = None,
) -> None:
    e = JobEvent(
        job_id=job_id,
        event=event,
        message=message,
        data=data,
    )
    session.add(e)
