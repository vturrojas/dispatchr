from fastapi import FastAPI

import app.db  # noqa: F401
from app.api.executors import router as executors_router
from app.api.job_events import router as job_events_router
from app.api.jobs import router as jobs_router

app = FastAPI(
    title="DispatchR",
    description="Automation & Background Job Execution Service",
    version="0.1.0",
)

app.include_router(jobs_router)
app.include_router(executors_router)
app.include_router(job_events_router)


@app.get("/health")
def health():
    return {"status": "ok"}
