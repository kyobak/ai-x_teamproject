"""
POST /api/admin/status   관리자·팀원 수동 입력 (센서/카메라가 없을 때의 대체 경로, Could 기능의 목업)

세탁기: state 를 직접 바꿉니다(센서 없는 기기용). 그 외: occupancy_level / occupancy_count.
프로토타입이라 인증이 없습니다. 실제 배포 시엔 관리자 로그인이 필요합니다.
"""
from __future__ import annotations

from datetime import timedelta

import json

from fastapi import APIRouter, Depends, Header, HTTPException

from app import config
from app.db import get_conn, iso, utcnow
from app.events import bus
from app.logic import laundry as L
from app.models import AdminStatusIn, ResourceIn
from app.services import build_resource_status, load_machine_state, process_queue, publish_resource, save_machine_state


def require_pin(x_admin_pin: str | None = Header(default=None)) -> None:
    """관리자 PIN 검사. 모든 /api/admin/* 에 Depends 로 붙습니다. (배포 시 로그인으로 교체)"""
    if x_admin_pin != config.ADMIN_PIN:
        raise HTTPException(401, "관리자 PIN 이 틀립니다")


router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_pin)])


@router.post("/login")
async def login():
    """PIN 이 맞는지만 확인 (틀리면 Depends 에서 401)."""
    return {"ok": True}


@router.post("/resources")
async def create_resource(body: ResourceIn):
    """자원 등록 (Could: 관리자 자원 등록 화면). 같은 id 가 있으면 덮어씁니다."""
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO resources(id, kind, zone, name, capacity, source, extra) VALUES (?,?,?,?,?,?,?) "
            "ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, zone=excluded.zone, name=excluded.name, "
            "capacity=excluded.capacity, source=excluded.source, extra=excluded.extra",
            (body.id, body.kind, body.zone, body.name, body.capacity, body.source, json.dumps(body.extra, ensure_ascii=False)),
        )
        data = publish_resource(conn, body.id)
    return {"ok": True, "resource": data}


@router.delete("/resources/{resource_id}")
async def delete_resource(resource_id: str):
    with get_conn() as conn:
        n = conn.execute("DELETE FROM resources WHERE id=?", (resource_id,)).rowcount
        if n == 0:
            raise HTTPException(404, "resource not found")
    bus.publish("resource_removed", {"id": resource_id})
    return {"ok": True}


@router.post("/status")
async def set_status(body: AdminStatusIn):
    now = utcnow()
    with get_conn() as conn:
        row = conn.execute("SELECT kind FROM resources WHERE id=?", (body.resource_id,)).fetchone()
        if not row:
            raise HTTPException(404, "resource not found")
        if row["kind"] == "laundry":
            if body.state not in (L.AVAILABLE, L.IN_USE, L.UNKNOWN):
                raise HTTPException(422, "state must be available|in_use|unknown")
            st = load_machine_state(conn, body.resource_id)
            st.state = body.state
            st.last_sample_at = now
            if body.state == L.IN_USE:
                st.in_use_since = now
                st.expected_end_at = now + timedelta(minutes=config.DEFAULT_CYCLE_MINUTES)
                st.last_vibration_at = now
            else:
                st.in_use_since = None
                st.expected_end_at = None
            save_machine_state(conn, body.resource_id, st)
            conn.execute("INSERT INTO status_events(resource_id, state, source, created_at) VALUES (?,?,?,?)",
                         (body.resource_id, body.state, "admin", iso(now)))
            if body.state == L.AVAILABLE:
                process_queue(conn, body.resource_id, now)
        else:
            conn.execute(
                "INSERT INTO status_events(resource_id, state, occupancy_level, source, created_at) VALUES (?,?,?,?,?)",
                (body.resource_id, str(body.occupancy_count) if body.occupancy_count is not None else None,
                 body.occupancy_level, "admin", iso(now)),
            )
        data = publish_resource(conn, body.resource_id)
    return {"ok": True, "resource": data}
