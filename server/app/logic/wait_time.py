"""
예상 대기시간 계산 (학식·셔틀 공통).  관련 요구사항: REQ-VIS-02, REQ-VIS-03, REQ-VIS-05, REQ-SHT-03

핵심 공식 (발표의 중심):
    예상 대기(분) = 줄 인원 ÷ 분당 처리 인원
"인원 수" 와 "대기시간" 은 다릅니다. 30명이 서 있어도 배식이 빠르면 5분이고,
셔틀은 버스 정원이 차면 다음 차를 기다려야 합니다. 그래서 인원만 세지 않고 처리율·정원을 같이 씁니다.

이 파일의 함수는 전부 "순수 함수" 입니다 (DB·네트워크 접근 없음) → tests/test_wait_time.py 에서 그대로 검증합니다.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime

from app import config


def estimate_wait_minutes(people_count: int, throughput_per_min: float) -> float:
    """줄 인원 ÷ 분당 처리 인원.  처리율이 0(배식 중단 등)이면 무한대 대신 큰 값(999)을 돌려 화면에서 '측정 불가' 로 다룹니다."""
    if people_count <= 0:
        return 0.0
    if throughput_per_min <= 0:
        return 999.0
    return round(people_count / throughput_per_min, 1)


def classify_level(est_wait_min: float) -> str:
    """예상 대기 분을 3단계로 바꿉니다. 사용자에게는 숫자보다 이 단계가 먼저 보입니다.
    (정확도 지표를 '3단계 분류 정확도' 로 바꿀 가능성을 계획서가 열어 뒀기 때문에 여기 경계값을 config 에 둡니다.)"""
    if est_wait_min <= config.LEVEL_RELAXED_MAX_MIN:
        return "relaxed"   # 여유
    if est_wait_min <= config.LEVEL_NORMAL_MAX_MIN:
        return "normal"    # 보통
    return "crowded"       # 혼잡


def fallback_throughput(now: datetime) -> float:
    """통과선을 볼 수 없어 처리율을 실시간으로 못 셀 때 쓰는 시간대별 상수. (REQ-VIS-05)
    3주차 현장 관찰에서 손으로 잰 값을 config.FALLBACK_THROUGHPUT_BY_HOUR 에 넣습니다."""
    return config.FALLBACK_THROUGHPUT_BY_HOUR.get(now.strftime("%H"), config.DEFAULT_THROUGHPUT_PER_MIN)


def is_vision_usable(last_seen: datetime | None, confidence: float | None, now: datetime) -> bool:
    """영상 수치를 그대로 믿어도 되는지. (REQ-VIS-03)
    - 마지막 수신이 VISION_STALE_SECONDS(60초) 보다 오래됐거나
    - 신뢰도가 기준 미만이면
    → False. 호출한 쪽은 제보·예측값으로 대체하고 그 사실을 화면에 표시해야 합니다."""
    if last_seen is None or confidence is None:
        return False
    if (now - last_seen).total_seconds() > config.VISION_STALE_SECONDS:
        return False
    return confidence >= config.VISION_MIN_CONFIDENCE


def shuttle_buses_until_boarding(people_ahead: int, bus_capacity: int | None = None) -> int:
    """셔틀: 내 앞에 people_ahead 명이 있을 때 몇 번째 버스에 탈 수 있는지. (REQ-SHT-03, Should)
    0 이면 다음 버스에 바로 탑승, 1 이면 한 대 보내고 그 다음 차."""
    cap = bus_capacity or config.SHUTTLE_BUS_CAPACITY
    if cap <= 0:
        return 0
    return math.floor(people_ahead / cap)


@dataclass
class ResolvedStatus:
    """대시보드에 보여줄 최종 상태. source 가 어디서 온 값인지 반드시 같이 보냅니다(추정임을 숨기지 않기 위해)."""
    people_count: int | None
    throughput_per_min: float | None
    est_wait_min: float | None
    level: str
    source: str           # vision | vision-fallback-throughput | report | prediction | admin | none
    note: str             # 화면에 그대로 띄울 한 줄 설명


def resolve_status(
    *,
    now: datetime,
    vision_count: int | None,
    vision_throughput: float | None,
    vision_confidence: float | None,
    vision_seen_at: datetime | None,
    report_level: str | None,
    prediction_level: str | None,
    admin_level: str | None,
) -> ResolvedStatus:
    """여러 데이터 공급원(영상 → 관리자 → 제보 → 예측) 을 우선순위대로 골라 하나의 상태로 만듭니다.
    우선순위 근거: 영상은 실측, 관리자는 사람이 직접 본 값, 제보는 익명 다수, 예측은 과거 평균."""
    # 1) 영상 수치가 신선하고 신뢰도가 충분하면 그대로 사용
    if vision_count is not None and is_vision_usable(vision_seen_at, vision_confidence, now):
        if vision_throughput is not None and vision_throughput > 0:
            thr, src, note = vision_throughput, "vision", "카메라 실측 (줄 인원 ÷ 분당 처리 인원)"
        else:
            # 통과선이 시야에 없어 처리율을 못 잰 경우 → 상수 사용, '추정 기반' 표시 (REQ-VIS-05)
            thr, src, note = fallback_throughput(now), "vision-fallback-throughput", "인원은 카메라 실측, 처리율은 시간대 평균 상수 (추정)"
        wait = estimate_wait_minutes(vision_count, thr)
        return ResolvedStatus(vision_count, thr, wait, classify_level(wait), src, note)

    # 2) 영상이 없거나 오래됨 → 사람이 입력한 값으로 대체 (REQ-VIS-03: 대체 사실을 표시)
    if admin_level:
        return ResolvedStatus(None, None, None, admin_level, "admin", "카메라 신호 없음 · 수동 입력은 30분간 유효")
    if report_level:
        return ResolvedStatus(None, None, None, report_level, "report", "카메라 신호 없음 · 최근 30분 제보 평균")
    if prediction_level:
        return ResolvedStatus(None, None, None, prediction_level, "prediction", "카메라 신호 없음 · 요일·시간대 과거 평균")
    return ResolvedStatus(None, None, None, "unknown", "none", "데이터 없음")
