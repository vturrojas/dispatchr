from typing import Any

from fastapi import APIRouter

from app.workers.executors import EXECUTORS

router = APIRouter(prefix="/executors", tags=["executors"])


# Curated docs for Swagger (keep it pretty + human)
EXECUTOR_CATALOG: dict[str, dict[str, Any]] = {
    "echo": {
        "name": "echo",
        "description": "Returns the payload unchanged. Useful for testing and debugging.",
        "payload_example": {"msg": "hello dispatchr"},
    },
    "sleep": {
        "name": "sleep",
        "description": "Sleeps for N seconds then returns how long it slept.",
        "payload_example": {"seconds": 2},
    },
    "http_request": {
        "name": "http_request",
        "description": "Performs an outbound HTTP request.",
        "payload_example": {
            "url": "https://example.com",
            "method": "GET",
            "headers": {"Accept": "application/json"},
            "body": None,
            "timeout": 5,
        },
    },
    # If you kept demo, document it:
    "demo": {
        "name": "demo",
        "description": "Legacy alias for echo (kept for compatibility).",
        "payload_example": {"msg": "hello dispatchr"},
    },
}


@router.get("", response_model=list[dict[str, Any]])
def list_executors() -> list[dict[str, Any]]:
    # Only list executors that exist in code
    out: list[dict[str, Any]] = []
    for name in sorted(EXECUTORS.keys()):
        out.append(EXECUTOR_CATALOG.get(
            name,
            {
                "name": name,
                "description": "(Undocumented executor)",
                "payload_example": {},
            },
        ))
    return out
