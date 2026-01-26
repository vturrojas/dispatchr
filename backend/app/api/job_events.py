from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import JobEvent
from app.db.session import get_session

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}/events", response_model=list[dict])
async def list_job_events(job_id: str, session: AsyncSession = Depends(get_session)):
    stmt = select(JobEvent).where(JobEvent.job_id == job_id).order_by(JobEvent.id.asc())
    result = await session.execute(stmt)
    events = result.scalars().all()

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
