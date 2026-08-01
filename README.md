[![CI](https://github.com/vturrojas/dispatchr/actions/workflows/tests.yml/badge.svg?branch=main&v=2)](https://github.com/vturrojas/dispatchr/actions/workflows/tests.yml)

# DispatchR

**DispatchR** is a production-style background job execution service built with **FastAPI**, **PostgreSQL**, and **Redis**, with a lightweight **React** UI for observability.

The project is intentionally scoped to demonstrate how backend systems handle **asynchronous work**, **durable state**, and **operational visibility** in practice — without unnecessary complexity or overengineering.

DispatchR favors clarity, explicit design choices, and debuggability over feature breadth.

---

## Why DispatchR Exists

Background job systems are often introduced as simple queues, but in real environments the harder problems are:

- Understanding *what happened* after a job was submitted  
- Reconstructing execution history during failures or retries  
- Observing work as it runs, not just after it finishes  
- Designing systems that can evolve safely over time  

DispatchR was built to explore those concerns directly, using a small but realistic architecture that emphasizes correctness and transparency.

---

## Design Approach (Backend-Focused)

This project reflects a set of deliberate backend engineering decisions:

- **Explicit lifecycle modeling**  
  Jobs move through a clearly defined set of states. Transitions are intentional and observable.

- **Durable event history**  
  All state changes are recorded in an append-only `job_events` table, preserving execution history for debugging and auditability.

- **Clear separation of responsibilities**  
  - The API validates intent and records state  
  - A scheduler identifies runnable work  
  - Workers execute jobs and emit events  

- **Failure and retry visibility**  
  Retries and failures are first-class concepts, not side effects hidden in logs.

- **Operational simplicity**  
  Server-Sent Events (SSE) are used for live streaming to avoid unnecessary infrastructure, while still enabling real-time visibility.

These choices mirror patterns used in production backend systems, scaled down to remain readable and maintainable.

---

## Architecture Overview

```
Client / CLI
   │
   │ REST + SSE
   ▼
FastAPI API
   │
   │ persists Jobs + JobEvents (append-only)
   ▼
PostgreSQL
   │
   │ runnable jobs
   ▼
Scheduler ─────────────▶ Redis (RQ)
                           │
                           │ dequeue
                           ▼
                        Worker
                           │
                           │ executes job + records events
                           ▼
                        JobEvents
```

---

## Core Backend Capabilities

- Job creation API with schema validation
- Persisted job states are `queued`, `scheduled`, `enqueued`, `running`, `succeeded`, `failed`, and `canceled`.
- Lifecycle events include `created`, `queued`, `scheduled`, `enqueued`, `running`, `retrying`, `succeeded`, and `failed`. `retrying` is an append-only event; the stored job returns to `queued` and never persists `retrying`. `canceled` is recognized, but there is no cancellation operation.
- Append-only event journal for durable state tracking
- Scheduler / worker execution model
- Pluggable executor registry
- Live execution streaming via Server-Sent Events (SSE)
- Alembic-managed database migrations
- Test suite focused on observable behavior
- CI enforcing linting and correctness

---

## Technology Stack

**API & Data**
- FastAPI
- Pydantic
- SQLAlchemy (async)
- PostgreSQL 16
- Alembic

**Async Execution**
- Redis
- RQ
- Dedicated scheduler and worker processes

**Observability**
- Server-Sent Events (SSE)
- Durable event records

**Tooling**
- Docker Compose
- Ruff
- Pytest
- GitHub Actions CI

---

## Local Development

### Start backend services

```bash
make up
make ps
make health
```

API documentation is available at:
```
http://127.0.0.1:8000/docs
```

### Start frontend (optional)

```bash
cd frontend
npm install
npm run dev
```

Frontend UI:
```
http://127.0.0.1:5173
```

---

## API Example

Create a job:

```bash
curl -X POST "http://127.0.0.1:8000/jobs" \
  -H "Content-Type: application/json" \
  -d '{"type":"sleep","payload":{"seconds":2}}'
```

Stream execution events:

```bash
curl -N "http://127.0.0.1:8000/jobs/<JOB_ID>/stream?from_id=0"
```

This provides a `tail -f`-style view of job execution.

---

## What This Project Signals

DispatchR is intended as a **backend-focused portfolio artifact** that demonstrates:

- Comfort working beyond request/response workflows  
- Practical experience with asynchronous execution models  
- Durable state modeling using event-oriented approaches  
- Thoughtful handling of failures and retries  
- Emphasis on observability and debuggability  
- Engineering judgment around scope and tradeoffs  

The project is deliberately modest in size, but representative of the kinds of systems commonly found in internal platforms and automation services.

---

## Non-Goals (Intentional)

To keep the system focused, DispatchR does not include:

- Authentication or authorization
- Multi-tenant isolation
- Cron-style scheduling
- Rate limiting or quotas
- Distributed tracing or metrics

These are intentionally deferred to preserve clarity in the core design.

---

## Possible Extensions

- A public job-cancellation operation.
- Progress events emitted by executors
- Recurring jobs
- Authentication and multi-tenancy
- Metrics and tracing

---

## Tests

```bash
make test
```

Tests emphasize externally observable behavior to keep refactors safe.

---

## License

MIT
