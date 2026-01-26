import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import JobEvent
from app.db.session import AsyncSessionLocal, get_session
from app.jobs import service
from app.jobs.schemas import JobCreate, JobOut
from app.workers.executors import EXECUTORS

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _validate_executor_type(executor_type: str) -> None:
    if executor_type not in EXECUTORS:
        raise HTTPException(
            status_code=400,
            detail={
                "error": f"Unknown executor type: {executor_type}",
                "hint": "See GET /executors for valid types",
                "valid_types": sorted(EXECUTORS.keys()),
            },
        )


@router.post("", response_model=JobOut, status_code=201)
async def create_job(payload: JobCreate, session: AsyncSession = Depends(get_session)):
    _validate_executor_type(payload.type)
    return await service.create_job(session, payload)


@router.get("", response_model=list[JobOut])
async def list_jobs(
    limit: int = 50,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
):
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    return await service.list_jobs(session, limit=limit, offset=offset)


@router.get("/{job_id}", response_model=JobOut)
async def get_job(job_id: str, session: AsyncSession = Depends(get_session)):
    job = await service.get_job(session, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/{job_id}/events")
async def get_job_events(job_id: str, session: AsyncSession = Depends(get_session)):
    stmt = (
        select(JobEvent)
        .where(JobEvent.job_id == job_id)
        .order_by(JobEvent.created_at.asc())
        .limit(500)
    )
    res = await session.execute(stmt)
    events = res.scalars().all()
    return [
        {
            "id": e.id,
            "job_id": e.job_id,
            "event": e.event,
            "message": e.message,
            "data": e.data,
            "created_at": e.created_at,
        }
        for e in events
    ]


@router.get("/{job_id}/stream")
async def stream_job_events(
    job_id: str,
    request: Request,
    from_id: int = 0,
    session: AsyncSession = Depends(get_session),
):
    # Fail fast if job doesn't exist (instead of streaming keep-alives forever)
    job = await service.get_job(session, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    async def gen() -> AsyncGenerator[str, None]:
        # Instruct SSE clients to retry quickly if disconnected
        yield "retry: 1000\n\n"

        last_id = max(from_id, 0)

        # Optional resume support: clients can send Last-Event-ID
        hdr = request.headers.get("last-event-id")
        if hdr and hdr.isdigit():
            last_id = max(last_id, int(hdr))

        while True:
            if await request.is_disconnected():
                return

            # Use a fresh DB session per poll (streaming-safe)
            async with AsyncSessionLocal() as s:
                stmt = (
                    select(JobEvent)
                    .where(JobEvent.job_id == job_id)
                    .where(JobEvent.id > last_id)
                    .order_by(JobEvent.id.asc())
                    .limit(500)
                )
                res = await s.execute(stmt)
                events = res.scalars().all()

            if events:
                for e in events:
                    last_id = e.id
                    payload = {
                        "id": e.id,
                        "job_id": e.job_id,
                        "event": e.event,
                        "message": e.message,
                        "data": e.data,
                        "created_at": e.created_at.isoformat() if e.created_at else None,
                    }
                    yield f"id: {e.id}\n"
                    yield f"event: {e.event}\n"
                    yield f"data: {json.dumps(payload)}\n\n"
            else:
                # Keep-alive so proxies don’t drop the connection
                yield ": keep-alive\n\n"

            await asyncio.sleep(2)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
