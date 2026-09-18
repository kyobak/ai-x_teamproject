"""
POST /api/reports    사용자 혼잡도 제보 (REQ-RPT-01: 10분 빈도 제한)

device_id 는 해시로만 저장합니다. 원본 기기 ID 를 서버가 오래 보관하지 않기 위해서입니다.
"""
from __future__ import annotations

import hashlib
from datetime import timedelta

from fastapi import APIRouter, HTTPException

from app import config
from app.db import get_conn, iso, parse_iso, utcnow
from app.models import ReportIn
from app.services import publish_resource

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("")
async def post_report(body: ReportIn):
    now = utcnow()
    device_hash = hashlib.sha256(body.device_id.encode()).hexdigest()[:32]
    with get_conn() as conn:
        if not conn.execute("SELECT 1 FROM resources WHERE id=?", (body.resource_id,)).fetchone():
            raise HTTPException(404, "resource not found")
        last = conn.execute(
            "SELECT created_at FROM reports WHERE resource_id=? AND device_hash=? ORDER BY created_at DESC LIMIT 1",
            (body.resource_id, device_hash),
        ).fetchone()
        if last:
            retry_at = parse_iso(last["created_at"]) + timedelta(minutes=config.REPORT_COOLDOWN_MINUTES)
            if now < retry_at:
                # 거부 + 재제보 가능 시각 안내 (REQ-RPT-01)
                raise HTTPException(429, detail={"message": "같은 장소에는 10분에 한 번만 제보할 수 있습니다",
                                                 "retry_at": iso(retry_at)})
        conn.execute(
            "INSERT INTO reports(resource_id, level, device_hash, created_at, expires_at) VALUES (?,?,?,?,?)",
            (body.resource_id, body.level, device_hash, iso(now), iso(now + timedelta(minutes=config.REPORT_TTL_MINUTES))),
        )
        publish_resource(conn, body.resource_id)
    return {"ok": True}
