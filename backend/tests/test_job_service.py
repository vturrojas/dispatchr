from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.models import JobEvent
from app.jobs import service
from app.jobs.schemas import JobCreate


@pytest.mark.anyio
async def test_create_get_and_list_immediate_and_scheduled_jobs(tmp_path) -> None:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'service.db'}")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    run_at = datetime.now(timezone.utc) + timedelta(hours=1)
    async with sessions() as session:
        immediate = await service.create_job(
            session,
            JobCreate(type="echo", payload={"message": "now"}, max_attempts=2),
        )
        scheduled = await service.create_job(
            session,
            JobCreate(type="echo", payload={"message": "later"}, run_at=run_at),
        )

        fetched = await service.get_job(session, immediate.id)
        jobs = await service.list_jobs(session, limit=10, offset=0)
        events = list(
            (await session.execute(select(JobEvent).order_by(JobEvent.id.asc()))).scalars().all()
        )

    assert fetched is not None
    assert fetched.id == immediate.id
    assert immediate.status == "queued"
    assert immediate.max_attempts == 2
    assert scheduled.status == "scheduled"
    assert scheduled.run_at is not None
    assert scheduled.run_at.replace(tzinfo=timezone.utc) == run_at
    assert {job.id for job in jobs} == {immediate.id, scheduled.id}
    assert [(event.job_id, event.event) for event in events] == [
        (immediate.id, "created"),
        (immediate.id, "queued"),
        (scheduled.id, "created"),
        (scheduled.id, "scheduled"),
    ]
    await engine.dispose()
