"""
세탁기 가상 대기열 규칙.  관련 요구사항: REQ-LAU-04, REQ-LAU-05

"예약" 이 아니라 "가상 대기열" 인 이유:
앱을 안 쓰는 학생이 먼저 세탁기를 쓰면 예약은 바로 깨집니다. 그래서 실물 우선 원칙을 지키고,
앱은 "기기가 비면 1순위에게 알려주는 안내 도구" 로만 둡니다.

티켓 상태: waiting → called → done | expired
- 기기가 available 로 바뀌면 1순위 waiting 티켓을 called 로 바꾸고 알림(REQ-LAU-04)
- called 후 QUEUE_CALL_TIMEOUT_MINUTES(5분) 안에 사용 시작이 없으면 expired 로 바꾸고 다음 순번 호출(REQ-LAU-05)
- 기기가 unknown 이면 호출하지 않음(REQ-LAU-07)

여기 함수들은 티켓 목록(dict 리스트)만 다루고 DB 는 라우터가 처리합니다.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from app import config


def next_to_call(tickets: list[dict]) -> dict | None:
    """waiting 티켓 중 position 이 가장 작은 것. 이미 called 상태인 티켓이 있으면 새로 부르지 않습니다(한 번에 한 명)."""
    if any(t["status"] == "called" for t in tickets):
        return None
    waiting = [t for t in tickets if t["status"] == "waiting"]
    if not waiting:
        return None
    return min(waiting, key=lambda t: t["position"])


def expired_calls(tickets: list[dict], now: datetime) -> list[dict]:
    """호출된 지 5분이 지난 티켓들. (REQ-LAU-05)"""
    limit = timedelta(minutes=config.QUEUE_CALL_TIMEOUT_MINUTES)
    return [t for t in tickets if t["status"] == "called" and t["called_at"] and now - t["called_at"] >= limit]


def next_position(tickets: list[dict]) -> int:
    """새 티켓의 순번 = 현재 살아있는(waiting/called) 티켓 중 최대 순번 + 1."""
    live = [t["position"] for t in tickets if t["status"] in ("waiting", "called")]
    return (max(live) + 1) if live else 1
