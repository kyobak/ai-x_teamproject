"""
실시간 갱신용 이벤트 버스 (Server-Sent Events, SSE).

왜 SSE 인가:
- 대시보드는 "서버 → 화면" 한 방향 갱신만 필요합니다. WebSocket 보다 단순하고 브라우저의 EventSource 한 줄로 받습니다.
- Supabase Realtime 을 쓰지 않는 대신, 상태가 바뀔 때마다 여기로 publish() 하면 모든 접속자에게 전달됩니다.

구조: 접속자마다 asyncio.Queue 하나. publish() 는 모든 큐에 같은 메시지를 넣습니다.
"""
from __future__ import annotations

import asyncio
import json


class EventBus:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    def publish(self, event: str, data: dict) -> None:
        """event: 'resource_updated' | 'queue_called' 등. data: JSON 으로 보낼 내용."""
        payload = json.dumps(data, ensure_ascii=False)
        for q in list(self._subscribers):
            try:
                q.put_nowait((event, payload))
            except asyncio.QueueFull:
                # 느린 클라이언트 때문에 서버가 멈추면 안 되므로 그 접속자 것만 버립니다.
                pass


bus = EventBus()
