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

**Execution flow**

1. POST /jobs -> creates job + “created/queued” events
2. Scheduler enqueues -> “enqueued” event (includes rq_id)
3. Worker runs -> “running” then “succeeded/failed/retrying” events
4. SSE stream tails job_events for real-time observability
