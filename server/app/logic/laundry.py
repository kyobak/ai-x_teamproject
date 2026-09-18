"""
세탁기 진동 판정 상태기계.  관련 요구사항: REQ-LAU-01, 02, 03, 06, 07

입력: 센서가 보내는 (시각, 진동 세기) 샘플 하나
출력: 갱신된 기기 상태

상태:
    available  사용 가능
    in_use     사용 중
    unknown    상태 불명 (센서 신호 끊김)

판정 규칙 (계획서 그대로):
- 진동 세기 > VIB_THRESHOLD 인 샘플이 VIB_START_SECONDS(30초) 이상 연속  → in_use 로 전환, 예상 종료 = 시작 + 50분  (REQ-LAU-01)
- in_use 상태에서 무진동이 VIB_END_MINUTES(T=5분) 이상 연속            → available 로 전환                     (REQ-LAU-02)
  * 세탁기는 불림·급수·배수 때 진동이 거의 없어서, 끊기자마자 종료로 보면 한 사이클에 종료를 여러 번 오판합니다.
- 예상 종료 시각이 지났는데 진동이 계속되면 in_use 유지, 화면엔 '동작 중' (REQ-LAU-03: 타이머보다 센서 우선)
- 신호가 SENSOR_STALE_MINUTES(30분) 이상 없으면 unknown (REQ-LAU-07) — 이 판정은 샘플이 안 오는 상황이므로
  main.py 의 주기 작업(background task)에서 mark_stale_if_needed() 로 검사합니다.

왜 클래스 대신 dataclass + 함수인가: 상태를 그대로 DB 에 저장/복원해야 해서 "데이터" 와 "규칙" 을 분리했습니다.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from app import config

AVAILABLE, IN_USE, UNKNOWN = "available", "in_use", "unknown"


@dataclass
class MachineState:
    state: str = AVAILABLE
    # 임계값을 넘는 진동이 "처음" 감지된 시각. 30초 연속 판정용. 무진동 샘플이 오면 None 으로 리셋.
    vib_started_at: datetime | None = None
    # 마지막으로 진동이 있었던 시각. 무진동 T분 연속 판정용.
    last_vibration_at: datetime | None = None
    # 마지막 샘플 수신 시각(진동 유무 무관). 신호 끊김(REQ-LAU-07) 판정용.
    last_sample_at: datetime | None = None
    # 사용 시작으로 판정한 시각과, 거기에 기본 코스를 더한 예상 종료 시각.
    in_use_since: datetime | None = None
    expected_end_at: datetime | None = None
    # 최근 사이클 실제 소요(분) 기록. 쌓이면 상수 50분 대신 기기별 평균으로 보정(Should).
    cycle_history_min: list[float] = field(default_factory=list)


def _expected_cycle_minutes(st: MachineState) -> float:
    """기기별 최근 평균이 있으면 그것을, 없으면 기본 50분. (Should: 기기별 소요 시간 학습)"""
    recent = st.cycle_history_min[-5:]
    if len(recent) >= 2:
        return sum(recent) / len(recent)
    return float(config.DEFAULT_CYCLE_MINUTES)


def process_sample(st: MachineState, ts: datetime, magnitude: float) -> tuple[MachineState, str | None]:
    """샘플 하나를 반영해 상태를 갱신합니다. 두 번째 반환값은 상태 전이 이벤트 이름(없으면 None)."""
    event: str | None = None
    st.last_sample_at = ts
    vibrating = magnitude > config.VIB_THRESHOLD

    # 신호가 다시 들어왔으니 unknown 은 해제. 진동 여부로 다음 로직이 결정.
    if st.state == UNKNOWN:
        st.state = AVAILABLE
        event = "signal_restored"

    if vibrating:
        st.last_vibration_at = ts
        if st.vib_started_at is None:
            st.vib_started_at = ts
        # 진동이 30초 이상 연속 → 사용 시작 (REQ-LAU-01)
        if st.state == AVAILABLE and (ts - st.vib_started_at).total_seconds() >= config.VIB_START_SECONDS:
            st.state = IN_USE
            st.in_use_since = st.vib_started_at
            st.expected_end_at = st.in_use_since + timedelta(minutes=_expected_cycle_minutes(st))
            event = "started"
    else:
        # 무진동 샘플: 30초 연속 카운트는 리셋
        st.vib_started_at = None
        # in_use 에서 무진동이 T분 이상 지속 → 종료 (REQ-LAU-02)
        if st.state == IN_USE and st.last_vibration_at is not None:
            quiet_min = (ts - st.last_vibration_at).total_seconds() / 60
            if quiet_min >= config.VIB_END_MINUTES:
                # 실제 소요 시간 = 마지막 진동 시각 - 시작 시각 (탈수가 끝난 시점을 종료로 봄)
                if st.in_use_since:
                    st.cycle_history_min.append((st.last_vibration_at - st.in_use_since).total_seconds() / 60)
                st.state = AVAILABLE
                st.in_use_since = None
                st.expected_end_at = None
                event = "finished"
    return st, event


def mark_stale_if_needed(st: MachineState, now: datetime) -> tuple[MachineState, str | None]:
    """샘플이 안 들어오는 동안 호출되는 검사. 30분 이상 무신호면 unknown. (REQ-LAU-07)"""
    if st.last_sample_at is None:
        return st, None
    if st.state != UNKNOWN and (now - st.last_sample_at).total_seconds() >= config.SENSOR_STALE_MINUTES * 60:
        st.state = UNKNOWN
        return st, "stale"
    return st, None


def display_info(st: MachineState, now: datetime) -> dict:
    """화면용 정보. 예상 종료는 '추정' 임을 문구로 명시합니다 (REQ-LAU-06).
    예상 종료를 넘겼는데 여전히 in_use 면 '동작 중(예상 시간 초과)' 로 바꿉니다 (REQ-LAU-03)."""
    if st.state == IN_USE and st.expected_end_at:
        remaining = (st.expected_end_at - now).total_seconds() / 60
        if remaining > 0:
            mins = round(remaining)
            # 1분 미만이면 "약 0분" 대신 "곧" 으로. 숫자 0 은 이미 끝난 것처럼 읽히기 때문입니다.
            label = "곧 종료 예상 (1분 이내)" if mins == 0 else f"약 {mins}분 후 종료 예상"
            return {"remaining_min": mins, "label": label, "overdue": False}
        return {"remaining_min": 0, "label": "동작 중 (예상 시간 초과, 센서 기준)", "overdue": True}
    if st.state == UNKNOWN:
        return {"remaining_min": None, "label": "상태 불명 (센서 신호 없음)", "overdue": False}
    return {"remaining_min": None, "label": "사용 가능", "overdue": False}
