from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

JobStatus = Literal["queued", "scheduled", "running", "succeeded", "failed", "canceled"]


class JobCreate(BaseModel):
    type: str = Field(..., examples=["http_request", "webhook", "sleep", "echo"])
    payload: dict[str, Any] = Field(default_factory=dict)
    run_at: datetime | None = None
    max_attempts: int = Field(3, ge=1, le=25)


class JobOut(BaseModel):
    id: str
    type: str
    status: JobStatus
    payload: dict[str, Any]
    run_at: datetime | None
    attempts: int
    max_attempts: int
    last_error: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
