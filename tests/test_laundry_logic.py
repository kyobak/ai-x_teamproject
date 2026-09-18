"""REQ-LAU-01, 02, 03, 07 — 진동 판정 상태기계 테스트. 샘플을 시간 순으로 흘려 넣고 상태를 확인합니다."""
from datetime import datetime, timedelta, timezone

from app import config
from app.logic import laundry as L

T0 = datetime(2026, 11, 2, 20, 0, tzinfo=timezone.utc)
HI = config.VIB_THRESHOLD + 0.5   # 진동 있음
LO = 0.0                          # 무진동


def feed(st, start, seconds, step, mag):
    """start 부터 seconds 동안 step 초 간격으로 mag 샘플을 넣습니다. 마지막 이벤트를 돌려줍니다."""
    last = None
    t = start
    while t <= start + timedelta(seconds=seconds):
        st, ev = L.process_sample(st, t, mag)
        last = ev or last
        t += timedelta(seconds=step)
    return st, last, t


def test_req_lau_01_needs_30s_of_vibration_to_start():
    st = L.MachineState()
    st, ev, _ = feed(st, T0, 20, 5, HI)          # 20초만 진동
    assert st.state == L.AVAILABLE and ev is None
    st, ev, _ = feed(st, T0 + timedelta(seconds=25), 10, 5, HI)   # 누적 35초
    assert st.state == L.IN_USE and ev == "started"
    assert st.expected_end_at == st.in_use_since + timedelta(minutes=config.DEFAULT_CYCLE_MINUTES)


def test_req_lau_02_short_pause_is_not_end_but_T_minutes_is():
    st = L.MachineState()
    st, _, t = feed(st, T0, 60, 5, HI)                            # 사용 시작
    assert st.state == L.IN_USE
    st, ev, t = feed(st, t, (config.VIB_END_MINUTES - 1) * 60, 10, LO)   # T-1 분 무진동 (불림 구간)
    assert st.state == L.IN_USE and ev is None
    st, _, t = feed(st, t, 30, 5, HI)                             # 다시 진동 (헹굼)
    st, ev, t = feed(st, t, config.VIB_END_MINUTES * 60 + 10, 10, LO)    # T 분 이상 무진동
    assert st.state == L.AVAILABLE and ev == "finished"
    assert len(st.cycle_history_min) == 1


def test_req_lau_03_sensor_beats_timer_when_overdue():
    st = L.MachineState()
    st, _, t = feed(st, T0, 60, 5, HI)
    late = st.expected_end_at + timedelta(minutes=3)
    st, ev = L.process_sample(st, late, HI)                        # 예상 종료 지나도 진동 중
    assert st.state == L.IN_USE
    info = L.display_info(st, late)
    assert info["overdue"] is True and "동작 중" in info["label"]


def test_req_lau_06_expected_end_is_labeled_as_estimate():
    st = L.MachineState()
    st, _, t = feed(st, T0, 60, 5, HI)
    assert "예상" in L.display_info(st, t)["label"]


def test_req_lau_07_no_signal_30min_becomes_unknown():
    st = L.MachineState()
    st, _, t = feed(st, T0, 60, 5, HI)
    st, ev = L.mark_stale_if_needed(st, t + timedelta(minutes=config.SENSOR_STALE_MINUTES - 1))
    assert ev is None and st.state == L.IN_USE
    st, ev = L.mark_stale_if_needed(st, t + timedelta(minutes=config.SENSOR_STALE_MINUTES + 1))
    assert ev == "stale" and st.state == L.UNKNOWN
