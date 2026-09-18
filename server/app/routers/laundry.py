"""
세탁실 슬라이스 B.

POST /api/sensors/vibration             센서 샘플 수신 → 상태기계 갱신 (REQ-LAU-01/02/03)
GET  /api/queue/{resource_id}           대기열 보기
POST /api/queue/{resource_id}/join      순번 등록
POST /api/queue/{resource_id}/leave     순번 취소
POST /api/queue/{resource_id}/start     호출받은 사람이 "사용 시작" 누름 → done
GET  /api/queue/me?device_id=...        내 티켓들
"""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException

from app.db import get_conn, iso, parse_iso, utcnow
from app.logic import laundry as L
from app.logic import queue as Q
from app.models import QueueActionIn, QueueJoinIn, VibrationSampleIn
from app.routers.vision import check_device_key
from app.services import live_tickets, load_machine_state, process_queue, publish_resource, save_machine_state
from app.events import bus

router = APIRouter(tags=["laundry"])


def _require_login(conn, authorization: str | None):
    """Authorization: Bearer <token> 이 users.token 과 일치해야 합니다 (routers/auth.py 에서 발급)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "줄 서기는 로그인 후 이용할 수 있습니다")
    row = conn.execute("SELECT id FROM users WHERE token=?", (authorization[7:],)).fetchone()
    if not row:
        raise HTTPException(401, "세션이 만료되었습니다. 다시 로그인하세요")
    return row


@router.post("/api/sensors/vibration")
async def post_vibration(body: VibrationSampleIn, x_device_key: str | None = Header(default=None)):
    check_device_key(x_device_key)
    ts = parse_iso(body.ts) or utcnow()
    with get_conn() as conn:
        row = conn.execute("SELECT kind FROM resources WHERE id=?", (body.resource_id,)).fetchone()
        if not row or row["kind"] != "laundry":
            raise HTTPException(404, "laundry resource not found")
        st = load_machine_state(conn, body.resource_id)
        st, event = L.process_sample(st, ts, body.magnitude)
        save_machine_state(conn, body.resource_id, st)
        conn.execute("INSERT INTO sensor_samples(resource_id, magnitude, ts) VALUES (?,?,?)",
                     (body.resource_id, body.magnitude, iso(ts)))
        conn.execute(
            "DELETE FROM sensor_samples WHERE resource_id=? AND id NOT IN "
            "(SELECT id FROM sensor_samples WHERE resource_id=? ORDER BY id DESC LIMIT 3000)",
            (body.resource_id, body.resource_id),
        )
        if event:
            conn.execute("INSERT INTO status_events(resource_id, state, source, created_at) VALUES (?,?,?,?)",
                         (body.resource_id, st.state, "sensor", iso(ts)))
            if event == "finished":
                process_queue(conn, body.resource_id, ts)   # 비었으니 1순위 호출 (REQ-LAU-04)
            elif event == "started":
                # 호출받은 사람이 시작했든 앱 비사용자가 먼저 썼든, 기기는 사용 중. 호출 티켓은 정리.
                for t in live_tickets(conn, body.resource_id):
                    if t["status"] == "called":
                        conn.execute("UPDATE queue_tickets SET status='done' WHERE id=?", (t["id"],))
                        # 화면의 "내 차례" 배너를 내리기 위해 이벤트 발행 (안 보내면 클라이언트가 옛 티켓을 계속 보여줌)
                        bus.publish("queue_done", {"resource_id": body.resource_id, "device_id": t["device_id"]})
        publish_resource(conn, body.resource_id)
    return {"ok": True, "state": st.state, "event": event}


# 주의: 이 라우트는 반드시 "/api/queue/{resource_id}" 보다 먼저 등록해야 합니다.
# FastAPI 는 등록 순서대로 매칭하므로, 뒤에 두면 "me" 가 resource_id 로 잡혀 빈 목록이 돌아옵니다(실제로 겪은 버그).
@router.get("/api/queue/me")
async def my_tickets(device_id: str):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT t.*, r.name FROM queue_tickets t JOIN resources r ON r.id=t.resource_id "
            "WHERE t.device_id=? AND t.status IN ('waiting','called') ORDER BY t.created_at",
            (device_id,),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            ahead = conn.execute(
                "SELECT COUNT(*) FROM queue_tickets WHERE resource_id=? AND status IN ('waiting','called') AND position<?",
                (d["resource_id"], d["position"]),
            ).fetchone()[0]
            d["people_ahead"] = ahead
            out.append(d)
        return out


@router.get("/api/queue/{resource_id}")
async def get_queue(resource_id: str):
    with get_conn() as conn:
        tickets = live_tickets(conn, resource_id)
        # 다른 사람의 device_id 는 노출하지 않고 순번과 상태만 돌려줍니다.
        return [{"position": t["position"], "status": t["status"]} for t in tickets]


@router.post("/api/queue/{resource_id}/join")
async def join_queue(resource_id: str, body: QueueJoinIn, authorization: str | None = Header(default=None)):
    """줄 서기는 로그인한 사용자만. (익명 기기만으로는 장난 등록을 막기 어렵고, 호출 알림을 받을 사람이 특정돼야 하므로)"""
    with get_conn() as conn:
        _require_login(conn, authorization)
        row = conn.execute("SELECT kind FROM resources WHERE id=?", (resource_id,)).fetchone()
        if not row or row["kind"] != "laundry":
            raise HTTPException(404, "laundry resource not found")
        tickets = live_tickets(conn, resource_id)
        if any(t["device_id"] == body.device_id for t in tickets):
            raise HTTPException(409, "이미 이 기기 대기열에 등록되어 있습니다")
        pos = Q.next_position(tickets)
        conn.execute(
            "INSERT INTO queue_tickets(resource_id, device_id, position, status, created_at) VALUES (?,?,?,?,?)",
            (resource_id, body.device_id, pos, "waiting", iso(utcnow())),
        )
        process_queue(conn, resource_id)   # 기기가 이미 비어 있으면 바로 호출
        publish_resource(conn, resource_id)
        return {"ok": True, "position": pos}


@router.post("/api/queue/{resource_id}/leave")
async def leave_queue(resource_id: str, body: QueueActionIn):
    with get_conn() as conn:
        n = conn.execute(
            "UPDATE queue_tickets SET status='left' WHERE resource_id=? AND device_id=? AND status IN ('waiting','called')",
            (resource_id, body.device_id),
        ).rowcount
        process_queue(conn, resource_id)   # 호출 중이던 사람이 나가면 다음 순번 호출
        publish_resource(conn, resource_id)
        return {"ok": True, "removed": n}


@router.post("/api/queue/{resource_id}/start")
async def start_using(resource_id: str, body: QueueActionIn):
    """호출받은 사람이 '사용 시작' 을 누름. 실제 사용 시작 판정은 센서가 하지만, 앱에선 티켓을 닫아줍니다."""
    with get_conn() as conn:
        n = conn.execute(
            "UPDATE queue_tickets SET status='done' WHERE resource_id=? AND device_id=? AND status='called'",
            (resource_id, body.device_id),
        ).rowcount
        if n == 0:
            raise HTTPException(409, "호출된 티켓이 없습니다")
        publish_resource(conn, resource_id)
        bus.publish("queue_done", {"resource_id": resource_id, "device_id": body.device_id})
        return {"ok": True}
