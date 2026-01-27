import asyncio
from typing import Any

import httpx

async def exec_sleep(payload: dict[str, Any]) -> dict[str, Any]:
    seconds = int(payload.get("seconds", 1))
    await asyncio.sleep(seconds)
    return {"slept": seconds}


async def exec_echo(payload: dict[str, Any]) -> dict[str, Any]:
    return {"echo": payload}


async def exec_http_request(payload: dict[str, Any]) -> dict[str, Any]:
    url = payload["url"]
    method = payload.get("method", "GET").upper()
    headers = payload.get("headers") or {}
    body = payload.get("body")
    timeout = float(payload.get("timeout", 10))

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.request(method, url, headers=headers, json=body)

    return {
        "url": url,
        "method": method,
        "status_code": resp.status_code,
        "elapsed_ms": int(resp.elapsed.total_seconds() * 1000),
        "response_text": resp.text[:500],
    }


EXECUTORS = {
    "sleep": exec_sleep,
    "echo": exec_echo,
    "http_request": exec_http_request,
}
