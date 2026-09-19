"""
시연용 가상 데이터 (데모 모드).

왜 있나: 카메라·센서가 붙지 않은 자원이 "정보 없음" 으로만 보이면 발표에서 서비스의 모습을 보여줄 수 없습니다.
config.DEMO_MODE 가 켜져 있으면, 실측·제보·관리자 입력이 전혀 없는 자원에 한해 "그럴듯한" 값을 만들어 채웁니다.
값은 시각과 자원 id 로 결정되는 의사난수라 새로고침해도 튀지 않고, 몇 분 단위로 서서히 변합니다.

정직성 유지: 이렇게 만든 값은 source="demo" 로 표시되어 화면에 "시연용 시뮬레이션" 이라고 나옵니다.
실측이 들어오는 순간 실측이 우선합니다 (services.build_resource_status 참고).
"""
from __future__ import annotations

import hashlib
import math
from datetime import datetime, timedelta


def _noise(key: str, t: datetime, period_min: int = 3) -> float:
    """0~1 의 의사난수. period_min 분 동안은 같은 값 → 화면이 안정적."""
    bucket = int(t.timestamp() // (period_min * 60))
    h = hashlib.md5(f"{key}:{bucket}".encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def _lunch_curve(t: datetime) -> float:
    """하루 중 혼잡도 0~1: 점심 12:15, 저녁 18:00 에 정점, 새벽엔 0."""
    h = t.hour + t.minute / 60
    lunch = math.exp(-((h - 12.25) ** 2) / 0.9)
    dinner = 0.7 * math.exp(-((h - 18.0) ** 2) / 0.8)
    base = 0.15 if 9 <= h <= 21 else 0.0
    return min(1.0, base + lunch + dinner)


def cafeteria(rid: str, t: datetime) -> dict:
    c = _lunch_curve(t)
    people = int(round(c * 34 + _noise(rid + "p", t) * 6))
    thr = round(4.5 + _noise(rid + "t", t, 5) * 3.5, 1)
    conf = round(0.55 + _noise(rid + "c", t, 7) * 0.3, 2)
    return {"people_count": people, "throughput_per_min": thr, "confidence": conf}


def shuttle(rid: str, t: datetime, direction: str | None = None, capacity: int = 45) -> dict:
    """셔틀 줄: 직전 버스가 떠난 뒤 도착률(명/분)만큼 쌓이고, 버스가 떠나는 순간 정원만큼 줄어듭니다.
    그래서 화면의 하냥이 줄이 시간이 지날수록 길어졌다가 출발 시각에 짧아집니다 (시연용)."""
    h = t.hour + t.minute / 60
    # 등교(8~9시)·하교(17~18시) 피크의 도착률. 한대앞역 → 학교 방향은 아침이, 학교 → 역 방향은 저녁이 붐빔.
    to_campus = direction == "hanyang_to_shuttlecock"
    morning = math.exp(-((h - 8.7) ** 2) / 0.5) * (1.0 if to_campus else 0.3)
    evening = math.exp(-((h - 17.5) ** 2) / 0.8) * (0.3 if to_campus else 1.0)
    rate = 0.3 + 5.0 * (morning + evening) + _noise(rid + "r", t, 10) * 0.5      # 명/분
    since, headway = 10.0, 10.0
    if direction:
        from app.logic import shuttle as S                                          # 순환 임포트 방지용 지연 임포트
        deps = S.departures_for(direction, t)
        hhmm = t.strftime("%H:%M")
        past = [d for d in deps if d <= hhmm]
        if past:
            ph, pm = map(int, past[-1].split(":"))
            since = (t - t.replace(hour=ph, minute=pm, second=0, microsecond=0)).total_seconds() / 60
            if len(past) >= 2:
                qh, qm = map(int, past[-2].split(":"))
                headway = (ph * 60 + pm) - (qh * 60 + qm)
    leftover = max(0.0, rate * headway - capacity)                                  # 직전 버스에 못 탄 사람
    people = int(round(rate * since + leftover + _noise(rid + "p", t) * 2))
    return {"people_count": max(0, people), "throughput_per_min": None, "confidence": round(0.5 + _noise(rid + "c", t, 7) * 0.3, 2)}


def space(rid: str, t: datetime, capacity: int | None) -> int:
    cap = capacity or 40
    h = t.hour + t.minute / 60
    c = 0.05 if h < 8 or h > 22 else 0.35 + 0.45 * math.exp(-((h - 15) ** 2) / 8)
    return int(round(min(cap, cap * c + _noise(rid + "o", t, 4) * 6)))


def parking(rid: str, t: datetime, capacity: int | None) -> int:
    cap = capacity or 100
    h = t.hour + t.minute / 60
    c = 0.1 if h < 7 or h > 21 else 0.5 + 0.4 * math.exp(-((h - 13) ** 2) / 10)
    return int(round(min(cap, cap * c + _noise(rid + "o", t, 5) * 8)))


def laundry(rid: str, t: datetime) -> dict:
    """세탁기: 각 기기가 자기만의 주기(60~75분)로 사용 중/사용 가능을 반복. 사용 중이면 남은 분도 냅니다."""
    period = 60 + int(_noise(rid + "period", datetime(2026, 1, 1)) * 15)           # 기기별 고정
    offset = int(_noise(rid + "offset", datetime(2026, 1, 1)) * period)            # 기기별 고정
    pos = (int(t.timestamp() // 60) + offset) % period
    busy_len = 45 if "-d" in rid else 50                                             # 건조기 45분, 세탁기 50분
    if pos < busy_len:
        return {"state": "in_use", "remaining_min": busy_len - pos, "in_use_since": t - timedelta(minutes=pos),
                "expected_end_at": t + timedelta(minutes=busy_len - pos)}
    return {"state": "available", "remaining_min": None, "in_use_since": None, "expected_end_at": None}
