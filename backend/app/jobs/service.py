from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Job
from app.jobs.events import record_event
from app.jobs.schemas import JobCreate


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def create_job(session: AsyncSession, payload: JobCreate) -> Job:
    """
    Create a job.

    Behavior:
    - If run_at is provided: create as scheduled and let scheduler enqueue it.
    - If run_at is None: enqueue immediately (push to RQ) and mark as queued.
    """
    run_at = payload.run_at

    if run_at is not None:
        status = "scheduled"
    else:
        status = "queued"

    job = Job(
        type=payload.type,
        status=status,
        payload=payload.payload,
        run_at=run_at,
        attempts=0,
        max_attempts=payload.max_attempts or 3,
    )

    session.add(job)
    await session.commit()
    await session.refresh(job)

    # Event: created
    await record_event(session, job.id, "created", f"Job created (type={job.type})")

    if status == "scheduled":
        await record_event(
            session,
            job.id,
            "scheduled",
            f"Scheduled for {job.run_at.isoformat() if job.run_at else 'unknown'}",
            data={"run_at": job.run_at.isoformat() if job.run_at else None},
        )
        await session.commit()
        return job

    # Immediate path: mark queued; scheduler will enqueue
    await record_event(session, job.id, "queued", "Job queued for immediate execution")
    await session.commit()
    return job


async def get_job(session: AsyncSession, job_id: str) -> Job | None:
    return await session.get(Job, job_id)


async def list_jobs(session: AsyncSession, limit: int = 50, offset: int = 0) -> list[Job]:
    stmt = select(Job).order_by(Job.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(stmt)
    return list(result.scalars().all())
