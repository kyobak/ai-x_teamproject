"""
셔틀 시간표 계산.  관련 요구사항: REQ-SHT-03

입력: 시간표(jobs/data/shuttle_timetable.json), 현재 시각, 정류장 줄 인원, 버스 정원
출력: 다음 출발들 + 각 출발까지 남은 분, "지금 줄 서면 몇 시 차를 탈 수 있는지"

탑승 예측 규칙 (계획서): 앞에 people_ahead 명이 있고 정원이 cap 이면, 내 앞 사람들이 floor(people_ahead / cap) 대를 채웁니다.
그래서 내가 타는 차 = 다음 출발 목록의 [floor(people_ahead / cap)] 번째. 예: 줄 52명, 정원 45 → 1대 보내고 2번째 차.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path

from app import config

TIMETABLE_PATH = config.BASE_DIR.parent / "jobs" / "data" / "shuttle_timetable.json"


@lru_cache(maxsize=1)
def load_timetable() -> dict:
    return json.loads(TIMETABLE_PATH.read_text(encoding="utf-8"))


def departures_for(direction: str, now_local: datetime) -> list[str]:
    """오늘 요일에 맞는 이 방향의 전체 출발 시각 목록 (HH:MM). 토·일은 주말 시간표."""
    tt = load_timetable()
    key = "weekend" if now_local.weekday() >= 5 else "weekday"
    return tt.get(key, {}).get(direction, [])


def upcoming(direction: str, now_local: datetime, n: int = 4) -> list[dict]:
    """다음 출발 n개와 남은 분. 출발 시각이 지난 것은 제외."""
    hhmm = now_local.strftime("%H:%M")
    out = []
    for t in departures_for(direction, now_local):
        if t >= hhmm:
            h, m = map(int, t.split(":"))
            dep = now_local.replace(hour=h, minute=m, second=0, microsecond=0)
            out.append({"time": t, "in_min": max(0, round((dep - now_local).total_seconds() / 60))})
            if len(out) >= n:
                break
    return out


def boarding(direction: str, now_local: datetime, people_ahead: int | None, capacity: int | None) -> dict:
    """지금 줄 서면 몇 번째 차(몇 시)를 타는지."""
    cap = capacity or load_timetable().get("bus_capacity", 45)
    ups = upcoming(direction, now_local, n=8)
    if not ups:
        return {"buses_to_wait": None, "board_time": None, "board_in_min": None, "note": "오늘 운행 종료"}
    if people_ahead is None:
        return {"buses_to_wait": None, "board_time": ups[0]["time"], "board_in_min": ups[0]["in_min"], "note": "줄 인원 정보 없음 · 다음 차 기준"}
    k = math.floor(people_ahead / cap) if cap else 0
    if k < len(ups):
        return {"buses_to_wait": k, "board_time": ups[k]["time"], "board_in_min": ups[k]["in_min"],
                "note": "다음 차 탑승 가능" if k == 0 else f"앞 {people_ahead}명이 {k}대를 채움"}
    return {"buses_to_wait": k, "board_time": None, "board_in_min": None, "note": "오늘 남은 운행으로는 탑승 어려움"}


def travel_minutes(direction: str) -> int | None:
    tt = load_timetable()
    d = tt["directions"].get(direction)
    if not d:
        return None
    return tt["travel_min"].get(f"{d['from']}->{d['to']}")
