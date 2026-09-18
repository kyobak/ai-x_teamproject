"""REQ-SHT-03 — 셔틀 시간표·탑승 예측 (jobs/data/shuttle_timetable.json 기준)."""
from datetime import datetime

from app.logic import shuttle as S

MON_1710 = datetime(2026, 11, 2, 17, 10)   # 월요일 17:10 (하교 피크)
SAT_1000 = datetime(2026, 11, 7, 10, 0)    # 토요일


def test_weekday_upcoming_departures_with_countdown():
    ups = S.upcoming("shuttlecock_to_hanyang", MON_1710, n=3)
    assert [u["time"] for u in ups] == ["17:12", "17:18", "17:24"]
    assert [u["in_min"] for u in ups] == [2, 8, 14]


def test_weekend_uses_weekend_table():
    assert [u["time"] for u in S.upcoming("shuttlecock_to_hanyang", SAT_1000, n=2)] == ["10:20", "10:50"]


def test_boarding_prediction_skips_full_buses():
    b = S.boarding("shuttlecock_to_hanyang", MON_1710, people_ahead=52, capacity=45)
    assert b["buses_to_wait"] == 1 and b["board_time"] == "17:18"
    b0 = S.boarding("shuttlecock_to_hanyang", MON_1710, people_ahead=10, capacity=45)
    assert b0["buses_to_wait"] == 0 and b0["board_time"] == "17:12"


def test_after_last_bus():
    late = datetime(2026, 11, 2, 23, 30)
    assert S.boarding("shuttlecock_to_hanyang", late, 5, 45)["board_time"] is None
