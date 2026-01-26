import asyncio
import traceback

from sqlalchemy.ext.asyncio import AsyncSession

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
        job = await session.get(Job, job_id)
        if not job:
            return

        # optimistic guard (belt + suspenders)
        if job.status not in ("queued", "enqueued"):
            return

        # state: running
        job.status = "running"
        job.attempts += 1
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

        await session.commit()

        # worker-driven retry loop: re-enqueue immediately
        if job.status == "queued":
            from app.workers.queue import queue

            rq_job = queue.enqueue("app.workers.tasks.run_job", job.id)
            await record_event(
                session,
                job.id,
                "enqueued",
                "Re-enqueued to RQ queue=dispatchr",
                data={"rq_id": rq_job.id},
            )
            await session.commit()
