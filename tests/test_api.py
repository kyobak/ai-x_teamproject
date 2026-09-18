"""API 수준 인수 테스트. REQ-VIS-01, REQ-LAU-04, REQ-LAU-05, REQ-RPT-01, REQ-SYS-01"""
from datetime import timedelta

from app import config
from app.db import get_conn, iso, utcnow

KEY = {"X-Device-Key": config.EDGE_API_KEY}
PIN = {"X-Admin-Pin": config.ADMIN_PIN}


def test_req_vis_01_metrics_endpoint_rejects_image_fields(client):
    bad = {"resource_id": "cafeteria-1", "people_count": 3, "confidence": 0.9, "image": "base64..."}
    assert client.post("/api/vision/metrics", json=bad, headers=KEY).status_code == 422


def test_vision_metrics_require_device_key(client):
    body = {"resource_id": "cafeteria-1", "people_count": 3, "confidence": 0.9}
    assert client.post("/api/vision/metrics", json=body).status_code == 401
    r = client.post("/api/vision/metrics", json={**body, "throughput_per_min": 1.0}, headers=KEY)
    assert r.status_code == 200 and r.json()["est_wait_min"] == 3.0
    d = client.get("/api/resources/cafeteria-1").json()
    assert d["people_count"] == 3 and d["source"] == "vision"


def test_req_lau_04_first_in_queue_is_called_when_machine_frees(client):
    # 기기를 사용 중으로 만든 뒤 두 명이 줄을 선다
    client.post("/api/admin/status", json={"resource_id": "laundry-w1", "state": "in_use"}, headers=PIN)
    assert client.post("/api/queue/laundry-w1/join", json={"device_id": "A"}).json()["position"] == 1
    assert client.post("/api/queue/laundry-w1/join", json={"device_id": "B"}).json()["position"] == 2
    assert client.post("/api/queue/laundry-w1/join", json={"device_id": "A"}).status_code == 409   # 중복 등록 금지
    # 기기가 비면 A 가 호출된다
    client.post("/api/admin/status", json={"resource_id": "laundry-w1", "state": "available"}, headers=PIN)
    q = client.get("/api/queue/laundry-w1").json()
    assert q[0] == {"position": 1, "status": "called"} and q[1]["status"] == "waiting"


def test_req_lau_05_called_ticket_expires_after_5min_and_next_is_called(client):
    client.post("/api/queue/laundry-w2/join", json={"device_id": "A"})   # 기기가 비어 있으니 즉시 호출
    client.post("/api/queue/laundry-w2/join", json={"device_id": "B"})
    # 호출 시각을 6분 전으로 되돌려 만료 상황을 만든다
    with get_conn() as conn:
        conn.execute("UPDATE queue_tickets SET called_at=? WHERE device_id='A'",
                     (iso(utcnow() - timedelta(minutes=config.QUEUE_CALL_TIMEOUT_MINUTES + 1)),))
    from app.services import process_queue
    with get_conn() as conn:
        process_queue(conn, "laundry-w2")
    q = client.get("/api/queue/laundry-w2").json()
    assert q == [{"position": 2, "status": "called"}]


def test_req_lau_07_unknown_machine_does_not_call(client):
    client.post("/api/admin/status", json={"resource_id": "laundry-w3", "state": "unknown"}, headers=PIN)
    client.post("/api/queue/laundry-w3/join", json={"device_id": "A"})
    assert client.get("/api/queue/laundry-w3").json() == [{"position": 1, "status": "waiting"}]


def test_req_rpt_01_second_report_within_10min_is_rejected(client):
    body = {"resource_id": "cafeteria-2", "level": 4, "device_id": "phone-1"}
    assert client.post("/api/reports", json=body).status_code == 200
    r = client.post("/api/reports", json=body)
    assert r.status_code == 429 and "retry_at" in r.json()["detail"]
    d = client.get("/api/resources/cafeteria-2").json()
    assert d["source"] == "report" and d["level"] == "crowded"


def test_req_sys_01_schema_has_no_personal_fields(client):
    with get_conn() as conn:
        cols = {row[1] for t in ("queue_tickets", "reports", "vision_metrics")
                for row in conn.execute(f"PRAGMA table_info({t})")}
    for forbidden in ("student_id", "name", "lat", "lng", "image", "frame"):
        assert forbidden not in cols


def test_queue_me_route_is_not_shadowed_by_resource_route(client):
    """/api/queue/me 가 /api/queue/{resource_id} 에 가려지면 내 티켓이 항상 빈 목록이 됩니다 (회귀 테스트)."""
    client.post("/api/queue/laundry-w2/join", json={"device_id": "phone-9"})
    mine = client.get("/api/queue/me", params={"device_id": "phone-9"}).json()
    assert len(mine) == 1 and mine[0]["resource_id"] == "laundry-w2" and mine[0]["status"] == "called"


def test_admin_requires_pin(client):
    body = {"resource_id": "laundry-w1", "state": "in_use"}
    assert client.post("/api/admin/status", json=body).status_code == 401
    assert client.post("/api/admin/status", json=body, headers=PIN).status_code == 200


def test_admin_can_register_resource(client):
    body = {"id": "laundry-w9", "kind": "laundry", "zone": "B동", "name": "세탁기 9", "source": "sensor", "extra": {"type": "washer"}}
    assert client.post("/api/admin/resources", json=body, headers=PIN).status_code == 200
    assert any(r["id"] == "laundry-w9" for r in client.get("/api/resources").json())
    assert client.delete("/api/admin/resources/laundry-w9", headers=PIN).status_code == 200


def test_space_qr_checkin_toggles_and_counts(client):
    r = client.post("/api/checkin/space-1", json={"device_id": "A"}).json()
    assert r["state"] == "checked_in" and r["occupancy_count"] == 1
    client.post("/api/checkin/space-1", json={"device_id": "B"})
    d = client.get("/api/resources/space-1").json()
    assert d["occupancy_count"] == 2 and d["source"] == "qr"
    assert client.post("/api/checkin/space-1", json={"device_id": "A"}).json()["state"] == "checked_out"
    assert client.get("/api/resources/space-1").json()["occupancy_count"] == 1


def test_push_public_key_and_subscribe(client):
    key = client.get("/api/push/public-key").json()["public_key"]
    assert len(key) > 60
    sub = {"endpoint": "https://push.example/abc", "keys": {"p256dh": "x", "auth": "y"}}
    assert client.post("/api/push/subscribe", json={"device_id": "A", "subscription": sub}).status_code == 200
