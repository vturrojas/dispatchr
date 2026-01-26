![CI](https://github.com/vturrojas/dispatchr/actions/workflows/tests.yml/badge.svg)

# DispatchR

A lightweight, extensible automation & background job execution service built with FastAPI.

Designed to emphasize correctness, clarity, and safe evolution over premature optimization—while still delivering a “wow factor” through first-class observability (durable event journaling + live SSE streaming).

---

**Tech stack:** FastAPI · PostgreSQL · SQLAlchemy (async) · Redis · RQ · Docker Compose · SSE · Ruff · Pytest

---

## What This Project Demonstrates

- A clean Job API for creating and observing background work
- Durable job lifecycle tracking via a `job_events` journal (append-only event history)
- Asynchronous execution with a scheduler + worker model (Redis + RQ)
- Real-time event streaming via Server-Sent Events (SSE) for “tail -f” style observability
- Executor registry pattern for pluggable job types
- Containerized local environment (Postgres, Redis, API, scheduler, worker)
- Developer experience tooling via Makefile commands

---

## Why It Matters

Most “background job” demos stop at “it runs in the background.” DispatchR goes one step further:

- You can explain **what happened**, **when**, and **why** for every job
- You can watch a job live in real time (SSE) without adding a UI framework or WebSockets
- Failures and retries are **explicit**, **durable**, and **observable**

This is closer to how production systems are designed:
- explicit state transitions
- append-only event logs for auditability
- simple, composable components (API / scheduler / worker)

---

## Non-Goals

This project intentionally does not include:
- Authentication or authorization (intentionally out of scope)
- Frontend UI (yet)
- Cron-style scheduling / complex triggers
- Multi-tenant isolation
- Rate limiting / quotas

These are deferred by design—the focus is a clean core with strong observability.

---

## Design Tradeoffs

- **RQ over Celery**: simpler mental model and fewer moving parts for a portfolio-grade reference system
- **Event journal (job_events)** instead of “just status fields”: preserves history and makes observability first-class
- **SSE** for live streaming instead of WebSockets: simpler infra, easier clients, still feels modern and real-time
- **Registry-based executors**: add new job types without refactoring worker code

---

## Possible Extensions

- Web UI dashboard that tails SSE streams
- Per-job progress events emitted by executors (`progress` events)
- Job cancellation + cooperative cancellation in executors
- Cron scheduling + recurring jobs
- Auth + multi-tenant isolation
- Metrics (Prometheus) + tracing (OpenTelemetry)

---

## Architecture (High Level)


    ┌──────────┐        ┌───────────────┐
    │  Client  │───────▶│  FastAPI API   │
    └──────────┘        └──────┬────────┘
                                │
                                │ writes Jobs + JobEvents
                                ▼
                           ┌──────────┐
                           │ Postgres │
                           └────┬─────┘
                                │ runnable jobs
                                ▼
                         ┌────────────┐       enqueue       ┌─────────┐
                         │ Scheduler  │────────────────────▶│  Redis  │
                         └────────────┘                      └────┬────┘
                                                                    │ dequeue
                                                                    ▼
                                                              ┌─────────┐
                                                              │ Worker  │
                                                              └────┬────┘
                                                                   │ executes + records events
                                                                   ▼
                                                               JobEvents


---

## Project Structure

```text
    backend/
    └── app/
        ├── api/            # HTTP routes (jobs, events, SSE stream)
        ├── jobs/           # job service, schemas, event recording
        ├── workers/        # scheduler, worker, queue wiring, tasks runner
        ├── db/             # models, session, init
        └── main.py         # FastAPI app entrypoint
```

---

## Run Locally

```bash
# from the repo root
make up
make ps
make health
```

Interactive API documentation will be available at:

http://127.0.0.1:8000/docs

---

## Demo (Live SSE Streaming)

**Create a job:**

```bash
JOB_ID=$(make job-sleep SECONDS=2 | tail -n 1)
echo JOB_ID=$JOB_ID
```

**Stream events live:**

```bash
curl -N "http://host.docker.internal:8000/jobs/$JOB_ID/stream?from_id=0"
```

**Expected lifecycle:**

- created
- queued
- enqueued
- running
- succeeded (with result payload)

---

## Failure and Retry Demo

**Submit a failing job (example uses http_request):**

make test-retry

**Expected lifecycle:**

- running
- retrying (until attempts exhausted)
- failed (with error and traceback)

---

## Run Tests 

make test

**Tests focus on observable behavior to keep refactors safe.**

---

## License

MIT
