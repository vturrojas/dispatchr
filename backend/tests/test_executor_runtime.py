from types import SimpleNamespace

import pytest

from app.api.executors import list_executors
from app.workers import executors


@pytest.mark.anyio
async def test_echo_and_sleep_executors(monkeypatch) -> None:
    slept_for: list[int] = []

    async def sleep(seconds: int) -> None:
        slept_for.append(seconds)

    monkeypatch.setattr(executors.asyncio, "sleep", sleep)

    assert await executors.exec_echo({"message": "hello"}) == {"echo": {"message": "hello"}}
    assert await executors.exec_sleep({"seconds": "2"}) == {"slept": 2}
    assert slept_for == [2]


@pytest.mark.anyio
async def test_http_executor_builds_request_and_bounds_response(monkeypatch) -> None:
    requests: list[tuple[str, str, dict[str, str], dict[str, object] | None]] = []

    class FakeClient:
        def __init__(self, *, timeout: float) -> None:
            assert timeout == 3.5

        async def __aenter__(self) -> "FakeClient":
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def request(
            self,
            method: str,
            url: str,
            *,
            headers: dict[str, str],
            json: dict[str, object] | None,
        ) -> SimpleNamespace:
            requests.append((method, url, headers, json))
            return SimpleNamespace(
                status_code=202,
                elapsed=SimpleNamespace(total_seconds=lambda: 0.0129),
                text="x" * 600,
            )

    monkeypatch.setattr(executors.httpx, "AsyncClient", FakeClient)

    result = await executors.exec_http_request(
        {
            "url": "https://example.test/hook",
            "method": "post",
            "headers": {"X-Test": "yes"},
            "body": {"ok": True},
            "timeout": "3.5",
        }
    )

    assert requests == [
        (
            "POST",
            "https://example.test/hook",
            {"X-Test": "yes"},
            {"ok": True},
        )
    ]
    assert result == {
        "url": "https://example.test/hook",
        "method": "POST",
        "status_code": 202,
        "elapsed_ms": 12,
        "response_text": "x" * 500,
    }


def test_executor_catalog_lists_only_registered_executors(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.executors.EXECUTORS",
        {"echo": object(), "custom": object()},
    )

    assert list_executors() == [
        {
            "name": "custom",
            "description": "(Undocumented executor)",
            "payload_example": {},
        },
        {
            "name": "echo",
            "description": "Returns the payload unchanged. Useful for testing and debugging.",
            "payload_example": {"msg": "hello dispatchr"},
        },
    ]
