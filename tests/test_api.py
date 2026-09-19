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


def test_req_lau_04_first_in_queue_is_called_when_machine_frees(client, auth):
    # 기기를 사용 중으로 만든 뒤 두 명이 줄을 선다
    client.post("/api/admin/status", json={"resource_id": "laundry-changui-w1", "state": "in_use"}, headers=PIN)
    assert client.post("/api/queue/laundry-changui-w1/join", json={"device_id": "A"}, headers=auth).json()["position"] == 1
    assert client.post("/api/queue/laundry-changui-w1/join", json={"device_id": "B"}, headers=auth).json()["position"] == 2
    assert client.post("/api/queue/laundry-changui-w1/join", json={"device_id": "A"}, headers=auth).status_code == 409   # 중복 등록 금지
    # 기기가 비면 A 가 호출된다
    client.post("/api/admin/status", json={"resource_id": "laundry-changui-w1", "state": "available"}, headers=PIN)
    q = client.get("/api/queue/laundry-changui-w1").json()
    assert q[0] == {"position": 1, "status": "called"} and q[1]["status"] == "waiting"


def test_req_lau_05_called_ticket_expires_after_5min_and_next_is_called(client, auth):
    client.post("/api/queue/laundry-changui-w2/join", json={"device_id": "A"}, headers=auth)   # 기기가 비어 있으니 즉시 호출
    client.post("/api/queue/laundry-changui-w2/join", json={"device_id": "B"}, headers=auth)
    # 호출 시각을 6분 전으로 되돌려 만료 상황을 만든다
    with get_conn() as conn:
        conn.execute("UPDATE queue_tickets SET called_at=? WHERE device_id='A'",
                     (iso(utcnow() - timedelta(minutes=config.QUEUE_CALL_TIMEOUT_MINUTES + 1)),))
    from app.services import process_queue
    with get_conn() as conn:
        process_queue(conn, "laundry-changui-w2")
    q = client.get("/api/queue/laundry-changui-w2").json()
    assert q == [{"position": 2, "status": "called"}]


def test_req_lau_07_unknown_machine_does_not_call(client, auth):
    client.post("/api/admin/status", json={"resource_id": "laundry-changui-w3", "state": "unknown"}, headers=PIN)
    client.post("/api/queue/laundry-changui-w3/join", json={"device_id": "A"}, headers=auth)
    assert client.get("/api/queue/laundry-changui-w3").json() == [{"position": 1, "status": "waiting"}]


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


def test_queue_me_route_is_not_shadowed_by_resource_route(client, auth):
    """/api/queue/me 가 /api/queue/{resource_id} 에 가려지면 내 티켓이 항상 빈 목록이 됩니다 (회귀 테스트)."""
    client.post("/api/queue/laundry-changui-w2/join", json={"device_id": "phone-9"}, headers=auth)
    mine = client.get("/api/queue/me", params={"device_id": "phone-9"}).json()
    assert len(mine) == 1 and mine[0]["resource_id"] == "laundry-changui-w2" and mine[0]["status"] == "called"


def test_admin_requires_pin(client):
    body = {"resource_id": "laundry-changui-w1", "state": "in_use"}
    assert client.post("/api/admin/status", json=body).status_code == 401
    assert client.post("/api/admin/status", json=body, headers=PIN).status_code == 200


def test_admin_can_register_resource(client):
    body = {"id": "laundry-changui-w9", "kind": "laundry", "zone": "창의관 세탁실", "name": "세탁기 9", "source": "sensor", "extra": {"type": "washer"}}
    assert client.post("/api/admin/resources", json=body, headers=PIN).status_code == 200
    assert any(r["id"] == "laundry-changui-w9" for r in client.get("/api/resources").json())
    assert client.delete("/api/admin/resources/laundry-changui-w9", headers=PIN).status_code == 200


def test_space_uses_camera_count_when_available(client):
    """오픈스페이스는 카메라(room 구역) 인원이 들어오면 그 값을 쓰고 출처를 vision 으로 표시."""
    body = {"resource_id": "space-yunghap-2", "people_count": 30, "confidence": 0.7, "zone_type": "room"}
    assert client.post("/api/vision/metrics", json=body, headers=KEY).status_code == 200
    d = client.get("/api/resources/space-yunghap-2").json()
    assert d["occupancy_count"] == 30 and d["source"] == "vision" and d["capacity"] == 45 and d["level"] == "normal"


def test_space_and_shuttle_seed_lists(client):
    rs = {r["id"]: r for r in client.get("/api/resources").json()}
    spaces = [r for r in rs.values() if r["kind"] == "space"]
    assert len(spaces) == 8 and rs["space-sci1"]["capacity"] == 25 and rs["space-design"]["name"] == "디자인라운지"
    assert sorted(r["id"] for r in rs.values() if r["kind"] == "shuttle") == ["shuttle-hanyang-campus", "shuttle-shuttlecock-hanyang"]


def test_push_public_key_and_subscribe(client):
    key = client.get("/api/push/public-key").json()["public_key"]
    assert len(key) > 60
    sub = {"endpoint": "https://push.example/abc", "keys": {"p256dh": "x", "auth": "y"}}
    assert client.post("/api/push/subscribe", json={"device_id": "A", "subscription": sub}).status_code == 200


def test_auth_register_login_prefs(client):
    r = client.post("/api/auth/register", json={"nickname": "뾰롱이", "password": "1234"})
    assert r.status_code == 200 and r.json()["token"]
    assert client.post("/api/auth/register", json={"nickname": "뾰롱이", "password": "1234"}).status_code == 409
    assert client.post("/api/auth/login", json={"nickname": "뾰롱이", "password": "wrong"}).status_code == 401
    token = client.post("/api/auth/login", json={"nickname": "뾰롱이", "password": "1234"}).json()["token"]
    h = {"Authorization": f"Bearer {token}"}
    prefs = {"dorm": "changui", "favorite_cafeteria": "cafeteria-1", "default_stop": "shuttle-shuttlecock-hanyang", "notify_queue": True, "notify_shuttle": False, "lang": "ko"}
    assert client.put("/api/auth/me/prefs", json=prefs, headers=h).json()["prefs"]["dorm"] == "changui"
    assert client.get("/api/auth/me", headers=h).json()["nickname"] == "뾰롱이"
    client.post("/api/auth/logout", headers=h)
    assert client.get("/api/auth/me", headers=h).status_code == 401


def test_demo_mode_fills_every_resource(client):
    """데모 모드: 실측이 없어도 unknown 이 아닌 값이 나오고, source 가 demo 로 정직하게 표시된다."""
    for r in client.get("/api/resources").json():
        assert r.get("level") != "unknown" or r["kind"] == "laundry", r["id"]
        if r["kind"] in ("cafeteria", "shuttle", "space", "parking"):
            assert r["source"] in ("demo", "vision", "qr", "admin", "report"), r["id"]


def test_laundry_seed_counts(client):
    rows = client.get("/api/resources").json()
    by = {}
    for r in rows:
        if r["kind"] == "laundry":
            by.setdefault((r["building"], r["machine_type"]), 0)
            by[(r["building"], r["machine_type"])] += 1
    assert by[("injae", "washer")] == 3 and by[("changui", "washer")] == 6 and by[("haengbok", "washer")] == 3
    assert by[("injae", "dryer")] == 3 and by[("changui", "dryer")] == 6 and by[("haengbok", "dryer")] == 3


def test_shuttle_has_timetable_and_boarding(client):
    d = client.get("/api/resources/shuttle-shuttlecock-hanyang").json()
    assert "upcoming" in d and "board_note" in d and d["direction"] == "shuttlecock_to_hanyang"


def test_queue_join_requires_login(client, auth):
    assert client.post("/api/queue/laundry-changui-w2/join", json={"device_id": "X"}).status_code == 401
    assert client.post("/api/queue/laundry-changui-w2/join", json={"device_id": "X"}, headers=auth).status_code == 200
