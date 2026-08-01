import asyncio
from types import SimpleNamespace

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.models import Job
from app.workers import scheduler, tasks


class FakeSession:
    def __init__(self, job: SimpleNamespace) -> None:
        self.job = job
        self.committed_statuses: list[str] = []

    async def __aenter__(self) -> "FakeSession":
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None

    async def get(self, _model: object, job_id: str) -> SimpleNamespace:
        assert job_id == self.job.id
        return self.job

    async def execute(self, _statement: object) -> SimpleNamespace:
        if self.job.status not in ("queued", "enqueued"):
            claimed_job = None
        else:
            self.job.status = "running"
            self.job.attempts += 1
            claimed_job = self.job
        return SimpleNamespace(scalar_one_or_none=lambda: claimed_job)

    async def commit(self) -> None:
        self.committed_statuses.append(self.job.status)


class PersistedJobStore:
    def __init__(self, job: SimpleNamespace) -> None:
        self.values = vars(job).copy()
        self.fail_next_commit = False

    def session(self) -> "PersistingSession":
        return PersistingSession(self)


class PersistingSession:
    def __init__(self, store: PersistedJobStore) -> None:
        self.store = store
        self.job = SimpleNamespace(**store.values)

    async def __aenter__(self) -> "PersistingSession":
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None

    async def get(self, _model: object, job_id: str) -> SimpleNamespace:
        assert job_id == self.job.id
        return self.job

    async def execute(self, _statement: object) -> SimpleNamespace:
        if self.job.status not in ("queued", "enqueued"):
            claimed_job = None
        else:
            self.job.status = "running"
            self.job.attempts += 1
            claimed_job = self.job
        return SimpleNamespace(scalar_one_or_none=lambda: claimed_job)

    async def commit(self) -> None:
        if self.store.fail_next_commit:
            self.store.fail_next_commit = False
            raise RuntimeError("simulated commit failure")
        self.store.values = vars(self.job).copy()


@pytest.mark.anyio
async def test_worker_retry_persists_recoverable_intent_before_enqueue(monkeypatch) -> None:
    job = SimpleNamespace(
        id="retry-job",
        type="always_fails",
        status="enqueued",
        payload={},
        result=None,
        attempts=0,
        max_attempts=3,
        last_error=None,
    )
    session = FakeSession(job)
    events: list[str] = []
    enqueued_job_ids: list[str] = []

    async def init_db() -> None:
        return None

    async def fail(_payload: dict[object, object]) -> None:
        raise RuntimeError("expected failure")

    async def record_event(
        _session: FakeSession,
        _job_id: str,
        event: str,
        _message: str,
        data: dict[str, object] | None = None,
    ) -> None:
        del data
        events.append(event)

    def enqueue(_function: str, job_id: str) -> SimpleNamespace:
        enqueued_job_ids.append(job_id)
        return SimpleNamespace(id="rq-retry")

    monkeypatch.setattr(tasks, "init_db", init_db)
    monkeypatch.setattr(tasks, "AsyncSessionLocal", lambda: session)
    monkeypatch.setattr(tasks, "EXECUTORS", {"always_fails": fail})
    monkeypatch.setattr(tasks, "record_event", record_event)
    monkeypatch.setattr("app.workers.queue.queue.enqueue", enqueue)

    await tasks._run_job_async(job.id)

    assert enqueued_job_ids == [job.id]
    assert events == ["running", "retrying", "enqueued"]
    assert session.committed_statuses == ["running", "queued", "enqueued"]
    assert job.status == "enqueued"


@pytest.mark.anyio
async def test_enqueue_failure_leaves_retry_durably_queued(monkeypatch) -> None:
    job = SimpleNamespace(
        id="enqueue-failure",
        type="always_fails",
        status="enqueued",
        payload={},
        result=None,
        attempts=0,
        max_attempts=3,
        last_error=None,
    )
    session = FakeSession(job)

    async def init_db() -> None:
        return None

    async def fail(_payload: dict[object, object]) -> None:
        raise RuntimeError("expected executor failure")

    async def record_event(*_args: object, **_kwargs: object) -> None:
        return None

    def fail_enqueue(_function: str, _job_id: str) -> None:
        raise RuntimeError("redis unavailable")

    monkeypatch.setattr(tasks, "init_db", init_db)
    monkeypatch.setattr(tasks, "AsyncSessionLocal", lambda: session)
    monkeypatch.setattr(tasks, "EXECUTORS", {"always_fails": fail})
    monkeypatch.setattr(tasks, "record_event", record_event)
    monkeypatch.setattr("app.workers.queue.queue.enqueue", fail_enqueue)

    with pytest.raises(RuntimeError, match="redis unavailable"):
        await tasks._run_job_async(job.id)

    assert session.committed_statuses[-1] == "queued"


@pytest.mark.anyio
async def test_retry_delivery_survives_post_enqueue_commit_failure(monkeypatch) -> None:
    job = SimpleNamespace(
        id="post-enqueue-commit-failure",
        type="fails_once",
        status="enqueued",
        payload={},
        result=None,
        attempts=0,
        max_attempts=3,
        last_error=None,
    )
    store = PersistedJobStore(job)
    executor_attempts = 0
    enqueued_job_ids: list[str] = []

    async def init_db() -> None:
        return None

    async def fail_once(_payload: dict[object, object]) -> dict[str, bool]:
        nonlocal executor_attempts
        executor_attempts += 1
        if executor_attempts == 1:
            raise RuntimeError("expected executor failure")
        return {"ok": True}

    async def record_event(*_args: object, **_kwargs: object) -> None:
        return None

    def enqueue(_function: str, job_id: str) -> SimpleNamespace:
        enqueued_job_ids.append(job_id)
        store.fail_next_commit = True
        return SimpleNamespace(id="rq-retry")

    monkeypatch.setattr(tasks, "init_db", init_db)
    monkeypatch.setattr(tasks, "AsyncSessionLocal", store.session)
    monkeypatch.setattr(tasks, "EXECUTORS", {"fails_once": fail_once})
    monkeypatch.setattr(tasks, "record_event", record_event)
    monkeypatch.setattr("app.workers.queue.queue.enqueue", enqueue)

    with pytest.raises(RuntimeError, match="simulated commit failure"):
        await tasks._run_job_async(job.id)

    assert enqueued_job_ids == [job.id]

    await tasks._run_job_async(job.id)

    assert executor_attempts == 2
    assert store.values["status"] == "succeeded"
    assert store.values["attempts"] == 2


@pytest.mark.anyio
async def test_concurrent_deliveries_atomically_claim_job_once(monkeypatch, tmp_path) -> None:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'claim.db'}")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with sessions() as session:
        session.add(
            Job(
                id="concurrent-delivery",
                type="succeeds",
                status="queued",
                payload={},
                attempts=0,
                max_attempts=3,
            )
        )
        await session.commit()

    running_events = 0
    both_workers_loaded = asyncio.Event()
    executor_calls = 0

    async def init_db() -> None:
        return None

    async def coordinate_running_event(
        _session: AsyncSession,
        _job_id: str,
        event: str,
        _message: str,
        data: dict[str, object] | None = None,
    ) -> None:
        nonlocal running_events
        del data
        if event != "running":
            return
        running_events += 1
        if running_events == 2:
            both_workers_loaded.set()
        try:
            await asyncio.wait_for(asyncio.shield(both_workers_loaded.wait()), timeout=0.25)
        except TimeoutError:
            pass

    async def succeed(_payload: dict[object, object]) -> dict[str, bool]:
        nonlocal executor_calls
        executor_calls += 1
        return {"ok": True}

    monkeypatch.setattr(tasks, "init_db", init_db)
    monkeypatch.setattr(tasks, "AsyncSessionLocal", sessions)
    monkeypatch.setattr(tasks, "EXECUTORS", {"succeeds": succeed})
    monkeypatch.setattr(tasks, "record_event", coordinate_running_event)

    await asyncio.gather(
        tasks._run_job_async("concurrent-delivery"),
        tasks._run_job_async("concurrent-delivery"),
    )

    async with sessions() as session:
        persisted_job = await session.get(Job, "concurrent-delivery")

    assert executor_calls == 1
    assert persisted_job is not None
    assert persisted_job.status == "succeeded"
    assert persisted_job.attempts == 1
    await engine.dispose()


@pytest.mark.anyio
async def test_scheduler_recovers_queued_intent_after_post_enqueue_commit_failure(
    monkeypatch, tmp_path
) -> None:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'recovery.db'}")
    regular_sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with regular_sessions() as session:
        session.add(
            Job(
                id="scheduler-recovery",
                type="always_fails",
                status="enqueued",
                payload={},
                attempts=0,
                max_attempts=3,
            )
        )
        await session.commit()

    fail_next_commit = False

    class CommitFailingSession(AsyncSession):
        async def commit(self) -> None:
            nonlocal fail_next_commit
            if fail_next_commit:
                fail_next_commit = False
                await self.rollback()
                raise RuntimeError("simulated post-enqueue commit failure")
            await super().commit()

    failing_sessions = async_sessionmaker(
        engine,
        class_=CommitFailingSession,
        expire_on_commit=False,
    )
    enqueue_calls: list[str] = []

    async def init_db() -> None:
        return None

    async def fail(_payload: dict[object, object]) -> None:
        raise RuntimeError("expected executor failure")

    async def record_event(*_args: object, **_kwargs: object) -> None:
        return None

    def enqueue(_function: str, job_id: str) -> SimpleNamespace:
        nonlocal fail_next_commit
        enqueue_calls.append(job_id)
        fail_next_commit = True
        return SimpleNamespace(id=f"rq-{len(enqueue_calls)}")

    monkeypatch.setattr(tasks, "init_db", init_db)
    monkeypatch.setattr(tasks, "AsyncSessionLocal", failing_sessions)
    monkeypatch.setattr(tasks, "EXECUTORS", {"always_fails": fail})
    monkeypatch.setattr(tasks, "record_event", record_event)
    monkeypatch.setattr("app.workers.queue.queue.enqueue", enqueue)

    with pytest.raises(RuntimeError, match="post-enqueue commit failure"):
        await tasks._run_job_async("scheduler-recovery")

    async with regular_sessions() as session:
        persisted_job = await session.get(Job, "scheduler-recovery")
        assert persisted_job is not None
        assert persisted_job.status == "queued"

    monkeypatch.setattr(scheduler, "AsyncSessionLocal", regular_sessions)
    monkeypatch.setattr(scheduler.queue, "enqueue", enqueue)
    await scheduler.tick()

    async with regular_sessions() as session:
        recovered_job = await session.get(Job, "scheduler-recovery")

    assert enqueue_calls == ["scheduler-recovery", "scheduler-recovery"]
    assert recovered_job is not None
    assert recovered_job.status == "enqueued"
    await engine.dispose()
