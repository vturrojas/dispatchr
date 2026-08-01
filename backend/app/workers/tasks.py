import asyncio
import traceback

from sqlalchemy import update

import app.db  # noqa: F401
from app.db.init_db import init_db
from app.db.models import Job
from app.db.session import AsyncSessionLocal
from app.jobs.events import record_event
from app.workers.executors import EXECUTORS


def run_job(job_id: str) -> None:
    # RQ expects a sync function, so we bridge to async
    asyncio.run(_run_job_async(job_id))


async def _run_job_async(job_id: str) -> None:
    await init_db()

    async with AsyncSessionLocal() as session:  # type: AsyncSession
        # A single conditional write is the delivery claim. Concurrent workers
        # cannot both advance the same runnable row to another attempt.
        claim = await session.execute(
            update(Job)
            .where(Job.id == job_id, Job.status.in_(("queued", "enqueued")))
            .values(status="running", attempts=Job.attempts + 1)
            .returning(Job)
        )
        job = claim.scalar_one_or_none()
        if job is None:
            return

        await record_event(session, job.id, "running", f"Worker started attempt {job.attempts}")
        await session.commit()

        try:
            executor = EXECUTORS.get(job.type)
            if not executor:
                raise ValueError(f"Unknown job type: {job.type}")

            result = await executor(job.payload)

            job.result = result
            job.status = "succeeded"
            job.last_error = None

            await record_event(
                session,
                job.id,
                "succeeded",
                "Job completed successfully",
                data={"result": result},
            )

        except Exception as e:
            err = f"{type(e).__name__}: {e}"
            tb = traceback.format_exc()

            job.last_error = err

            if job.attempts < job.max_attempts:
                # Persist scheduler-recoverable retry intent before touching
                # Redis. Duplicate deliveries remain protected by the worker's
                # conditional database claim above.
                job.status = "queued"
                await record_event(
                    session,
                    job.id,
                    "retrying",
                    f"Job failed (will retry) attempt={job.attempts}/{job.max_attempts}",
                    data={"error": err, "traceback": tb},
                )
            else:
                job.status = "failed"
                await record_event(
                    session,
                    job.id,
                    "failed",
                    f"Job failed permanently attempt={job.attempts}/{job.max_attempts}",
                    data={"error": err, "traceback": tb},
                )

        # Redis and the database are not atomic. Commit the retry intent first so
        # either the scheduler or this immediate enqueue can deliver it.
        await session.commit()

        # worker-driven retry loop: re-enqueue immediately
        if job.status == "queued":
            from app.workers.queue import queue

            rq_job = queue.enqueue("app.workers.tasks.run_job", job.id)
            job.status = "enqueued"
            await record_event(
                session,
                job.id,
                "enqueued",
                "Re-enqueued to RQ queue=dispatchr",
                data={"rq_id": rq_job.id},
            )
            await session.commit()
