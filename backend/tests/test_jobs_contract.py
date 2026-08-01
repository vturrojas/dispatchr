from collections.abc import AsyncIterator
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import get_args

import httpx
import pytest
from pydantic import ValidationError

from app.api.jobs import service
from app.db.session import get_session
from app.jobs.schemas import JobOut, JobStatus
from app.main import app


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    async def override_get_session():
        yield object()

    app.dependency_overrides[get_session] = override_get_session
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as async_client:
            yield async_client
    finally:
        app.dependency_overrides.pop(get_session, None)


def stored_job(*, status: str, result: dict[str, object] | None) -> SimpleNamespace:
    timestamp = datetime(2026, 8, 1, tzinfo=timezone.utc)
    return SimpleNamespace(
        id="job-contract",
        type="echo",
        status=status,
        payload={"message": "hello"},
        result=result,
        run_at=None,
        attempts=0,
        max_attempts=3,
        last_error=None,
        created_at=timestamp,
        updated_at=timestamp,
    )


@pytest.mark.anyio
async def test_get_job_serializes_enqueued_status_and_stored_result(
    monkeypatch, client: httpx.AsyncClient
) -> None:
    result = {"echo": "hello"}

    async def get_job(_session, job_id: str) -> SimpleNamespace:
        assert job_id == "job-contract"
        return stored_job(status="enqueued", result=result)

    monkeypatch.setattr(service, "get_job", get_job)

    response = await client.get("/jobs/job-contract")

    assert response.status_code == 200
    assert response.json()["status"] == "enqueued"
    assert response.json()["result"] == result


@pytest.mark.anyio
async def test_get_job_serializes_nullable_result(monkeypatch, client: httpx.AsyncClient) -> None:
    async def get_job(_session, _job_id: str) -> SimpleNamespace:
        return stored_job(status="queued", result=None)

    monkeypatch.setattr(service, "get_job", get_job)

    response = await client.get("/jobs/job-contract")

    assert response.status_code == 200
    assert response.json()["result"] is None


def test_job_status_matches_stored_status_contract() -> None:
    assert set(get_args(JobStatus)) == {
        "queued",
        "scheduled",
        "enqueued",
        "running",
        "succeeded",
        "failed",
        "canceled",
    }
    assert "retrying" not in get_args(JobStatus)


def test_job_out_rejects_retrying_status() -> None:
    with pytest.raises(ValidationError):
        JobOut.model_validate(stored_job(status="retrying", result=None))
