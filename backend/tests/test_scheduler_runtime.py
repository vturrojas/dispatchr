from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.models import Job, JobEvent
from app.workers import scheduler


@pytest.mark.anyio
async def test_tick_enqueues_due_scheduled_and_immediate_jobs(monkeypatch, tmp_path) -> None:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'scheduler.db'}")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime.now(timezone.utc)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with sessions() as session:
        session.add_all(
            [
                Job(
                    id="due",
                    type="echo",
                    status="scheduled",
                    payload={},
                    run_at=now - timedelta(minutes=1),
                ),
                Job(id="immediate", type="echo", status="queued", payload={}),
                Job(
                    id="future",
                    type="echo",
                    status="scheduled",
                    payload={},
                    run_at=now + timedelta(hours=1),
                ),
            ]
        )
        await session.commit()

    enqueued_ids: list[str] = []

    def enqueue(_function: str, job_id: str) -> SimpleNamespace:
        enqueued_ids.append(job_id)
        return SimpleNamespace(id=f"rq-{job_id}")

    monkeypatch.setattr(scheduler, "AsyncSessionLocal", sessions)
    monkeypatch.setattr(scheduler.queue, "enqueue", enqueue)

    await scheduler.tick()

    async with sessions() as session:
        jobs = {job.id: job for job in (await session.execute(select(Job))).scalars().all()}
        events = list(
            (await session.execute(select(JobEvent).order_by(JobEvent.id.asc()))).scalars().all()
        )

    assert set(enqueued_ids) == {"due", "immediate"}
    assert jobs["due"].status == "enqueued"
    assert jobs["immediate"].status == "enqueued"
    assert jobs["future"].status == "scheduled"
    assert [(event.job_id, event.event) for event in events] == [
        ("due", "queued"),
        ("due", "enqueued"),
        ("immediate", "enqueued"),
    ]
    await engine.dispose()
