"""
오픈스페이스 QR 체크인 (Could 범위).

POST /api/checkin/{resource_id}          {device_id} → 재실 중이면 퇴실, 아니면 입실 (토글)
GET  /api/checkin/{resource_id}/me       내 재실 여부
GET  /api/checkin/{resource_id}/qr.png?base=https://...   입구에 붙일 QR (웹앱의 /checkin/{id} 로 연결)

원리: 입구 QR 을 찍으면 웹앱 /checkin/space-1 이 열리고, 버튼 한 번으로 입실/퇴실. 재실 인원 = 퇴실 안 한 체크인 수.
퇴실을 안 찍는 사람이 많을 것이므로 CHECKIN_AUTO_EXPIRE_MINUTES 뒤 자동 퇴실(main.py 주기 작업).
"""
from __future__ import annotations

import io

import qrcode
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.db import get_conn, iso, utcnow
from app.models import CheckinIn
from app.services import publish_resource

router = APIRouter(prefix="/api/checkin", tags=["checkin"])


def _open_checkin(conn, resource_id: str, device_id: str):
    return conn.execute(
        "SELECT id FROM checkins WHERE resource_id=? AND device_id=? AND checked_out_at IS NULL", (resource_id, device_id)
    ).fetchone()


@router.post("/{resource_id}")
async def toggle(resource_id: str, body: CheckinIn):
    now = utcnow()
    with get_conn() as conn:
        row = conn.execute("SELECT kind FROM resources WHERE id=?", (resource_id,)).fetchone()
        if not row or row["kind"] != "space":
            raise HTTPException(404, "space resource not found")
        open_ = _open_checkin(conn, resource_id, body.device_id)
        if open_:
            conn.execute("UPDATE checkins SET checked_out_at=? WHERE id=?", (iso(now), open_["id"]))
            state = "checked_out"
        else:
            conn.execute("INSERT INTO checkins(resource_id, device_id, checked_in_at) VALUES (?,?,?)",
                         (resource_id, body.device_id, iso(now)))
            state = "checked_in"
        data = publish_resource(conn, resource_id)
    return {"ok": True, "state": state, "occupancy_count": data.get("occupancy_count")}


@router.get("/{resource_id}/me")
async def me(resource_id: str, device_id: str):
    with get_conn() as conn:
        return {"checked_in": _open_checkin(conn, resource_id, device_id) is not None}


@router.get("/{resource_id}/qr.png")
async def qr_png(resource_id: str, base: str = Query(..., description="웹앱 주소, 예: http://192.168.0.10:3000")):
    img = qrcode.make(f"{base.rstrip('/')}/checkin/{resource_id}")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(buf.getvalue(), media_type="image/png")
