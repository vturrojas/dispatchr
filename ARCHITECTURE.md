## DispatchR Architecture (High Level)

**Components**

- API (FastAPI): job submission + job querying + event history + SSE stream
- Postgres: jobs + job_events (append-only journal)
- Redis + RQ: queueing and execution
- Scheduler: finds runnable jobs and enqueues them
- Worker: executes jobs via executor registry and records lifecycle events

**Data model**

- jobs: current state + attempts + result + error

- job_events: ordered history of state transitions and metadata

Persisted job states are `queued`, `scheduled`, `enqueued`, `running`, `succeeded`, `failed`, and `canceled`.

Lifecycle events include `created`, `queued`, `scheduled`, `enqueued`, `running`, `retrying`, `succeeded`, and `failed`. `retrying` is an append-only event; the stored job returns to `queued` and never persists `retrying`. `canceled` is recognized, but there is no cancellation operation.

**Execution flow**

1. POST /jobs -> immediate jobs record “created” then “queued”; delayed jobs record “created” then “scheduled”
2. Scheduler later queues/enqueues delayed jobs -> “queued” then “enqueued” events (includes rq_id)
3. Worker runs -> “running” then “succeeded/failed” events; retries append a “retrying” event before the stored job returns to “queued”
4. SSE stream tails job_events for real-time observability
