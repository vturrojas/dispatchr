import asyncio
from datetime import datetime, timezone

from sqlalchemy import or_, select

import app.db  # noqa: F401
from app.db.init_db import init_db
from app.db.models import Job
from app.db.session import AsyncSessionLocal
from app.jobs.events import record_event
from app.workers.queue import queue

POLL_SECONDS = 2


def utcnow():
    return datetime.now(timezone.utc)


async def tick():
    async with AsyncSessionLocal() as session:  # type: AsyncSession
        now = utcnow()

        # Pick up:
        # 1) queued jobs that are runnable now (run_at null OR <= now)
        # 2) scheduled jobs whose time has arrived
        stmt = (
            select(Job)
            .where(
                or_(
                    # immediate/queued
                    (Job.status == "queued") & ((Job.run_at.is_(None)) | (Job.run_at <= now)),
                    # scheduled -> queued -> enqueued
                    (Job.status == "scheduled") & (Job.run_at <= now),
                )
            )
            .limit(50)
        )

        result = await session.execute(stmt)
        jobs = list(result.scalars().all())

        for job in jobs:
            # scheduled -> queued (journal it)
            if job.status == "scheduled":
                job.status = "queued"
                await record_event(
                    session,
                    job.id,
                    "queued",
                    "Job queued for execution",
                    data={"source": "scheduler"},
                )

            # queued -> enqueued (REAL enqueue)
            # (guard: only enqueue if currently queued)
            if job.status == "queued":
                rq_job = queue.enqueue("app.workers.tasks.run_job", job.id)
                job.status = "enqueued"

                await record_event(
                    session,
                    job.id,
                    "enqueued",
                    "Enqueued to RQ queue=dispatchr",
                    data={"source": "scheduler", "rq_id": rq_job.id},
                )

        if jobs:
            await session.commit()


async def main():
    while True:
        try:
            await init_db()
            break
        except Exception as e:
            print(f"[scheduler] db not ready yet: {e}")
            await asyncio.sleep(1)

    while True:
        await tick()
        await asyncio.sleep(POLL_SECONDS)


if __name__ == "__main__":
    asyncio.run(main())
