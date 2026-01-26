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

app.router.redirect_slashes = False

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(jobs_router)
app.include_router(executors_router)
app.include_router(job_events_router)


@app.get("/health")
def health():
    return {"status": "ok"}
