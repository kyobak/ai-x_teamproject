"""REQ-VIS-02, REQ-VIS-03, REQ-VIS-05, REQ-SHT-03 — 대기시간 계산 순수 함수 테스트."""
from datetime import datetime, timedelta, timezone

from app import config
from app.logic import wait_time as W

NOW = datetime(2026, 11, 2, 12, 10, tzinfo=timezone.utc)


def test_req_vis_02_wait_is_count_divided_by_throughput():
    assert W.estimate_wait_minutes(30, 6.0) == 5.0
    assert W.estimate_wait_minutes(0, 6.0) == 0.0


def test_req_vis_02_zero_throughput_does_not_crash():
    assert W.estimate_wait_minutes(10, 0.0) == 999.0


def test_level_thresholds():
    assert W.classify_level(3) == "relaxed"
    assert W.classify_level(10) == "normal"
    assert W.classify_level(20) == "crowded"


def test_req_vis_03_stale_signal_falls_back_to_report():
    old = NOW - timedelta(seconds=config.VISION_STALE_SECONDS + 1)
    s = W.resolve_status(now=NOW, vision_count=30, vision_throughput=6, vision_confidence=0.9, vision_seen_at=old,
                         report_level="normal", prediction_level="crowded", admin_level=None)
    assert s.source == "report" and s.level == "normal" and s.est_wait_min is None


def test_req_vis_03_low_confidence_falls_back_to_prediction():
    s = W.resolve_status(now=NOW, vision_count=30, vision_throughput=6, vision_confidence=0.1, vision_seen_at=NOW,
                         report_level=None, prediction_level="crowded", admin_level=None)
    assert s.source == "prediction" and s.level == "crowded"


def test_req_vis_05_missing_throughput_uses_hourly_constant_and_flags_it():
    s = W.resolve_status(now=NOW, vision_count=24, vision_throughput=None, vision_confidence=0.9, vision_seen_at=NOW,
                         report_level=None, prediction_level=None, admin_level=None)
    assert s.source == "vision-fallback-throughput"
    assert s.throughput_per_min == W.fallback_throughput(NOW)
    assert "추정" in s.note


def test_req_sht_03_buses_to_wait():
    assert W.shuttle_buses_until_boarding(10, 45) == 0     # 다음 차 탑승
    assert W.shuttle_buses_until_boarding(45, 45) == 1     # 한 대 보내야 함
    assert W.shuttle_buses_until_boarding(100, 45) == 2
