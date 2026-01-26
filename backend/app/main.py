from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.db  # noqa: F401
from app.api.executors import router as executors_router
from app.api.job_events import router as job_events_router
from app.api.jobs import router as jobs_router

app = FastAPI(
    title="DispatchR",
    description="Automation & Background Job Execution Service",
    version="0.1.0",
)

# Avoid redirect behavior on /jobs vs /jobs/
app.router.redirect_slashes = False

# Dev CORS (tighten later if desired)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
