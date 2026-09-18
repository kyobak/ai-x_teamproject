"""
GET /api/stream    Server-Sent Events. 브라우저는 `new EventSource('/api/stream')` 으로 받습니다.

메시지 형식:
    event: resource_updated
    data: {...자원 상태 JSON...}

15초마다 ':ping' 주석을 보내 프록시/브라우저가 연결을 끊지 않게 합니다.
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.events import bus

router = APIRouter(tags=["stream"])


@router.get("/api/stream")
async def stream(request: Request):
    q = bus.subscribe()

    async def gen():
        try:
            yield "event: hello\ndata: {}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event, payload = await asyncio.wait_for(q.get(), timeout=15)
                    yield f"event: {event}\ndata: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            bus.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
