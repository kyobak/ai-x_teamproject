"""
POST /api/vision/metrics    엣지 기기가 숫자만 보내는 곳 (REQ-VIS-01, REQ-VIS-02)

헤더 X-Device-Key 로 기기를 인증합니다. 이미지가 올 수 있는 필드는 아예 없습니다.
받은 즉시 예상 대기시간을 계산해 저장하고, SSE 로 대시보드에 밀어 넣습니다(10초 이내 반영 요구 충족).
"""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException

from app import config
from app.db import get_conn, iso, utcnow
from app.logic import wait_time as W
from app.models import VisionMetricIn
from app.services import publish_resource

router = APIRouter(prefix="/api/vision", tags=["vision"])


def check_device_key(key: str | None) -> None:
    if key != config.EDGE_API_KEY:
        raise HTTPException(401, "invalid device key")


@router.post("/metrics")
async def post_metrics(body: VisionMetricIn, x_device_key: str | None = Header(default=None)):
    check_device_key(x_device_key)
    now = utcnow()
    thr = body.throughput_per_min if body.throughput_per_min else W.fallback_throughput(now.astimezone())
    est = W.estimate_wait_minutes(body.people_count, thr)
    with get_conn() as conn:
        if not conn.execute("SELECT 1 FROM resources WHERE id=?", (body.resource_id,)).fetchone():
            raise HTTPException(404, "resource not found")
        conn.execute(
            "INSERT INTO vision_metrics(resource_id, people_count, throughput_per_min, est_wait_min, confidence, device_id, created_at, avg_dwell_sec, zone_type) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (body.resource_id, body.people_count, body.throughput_per_min, est, body.confidence, body.device_id, iso(now), body.avg_dwell_sec, body.zone_type),
        )
        # 오래된 수치는 지워 DB 가 무한히 커지지 않게 (최근 2000건만 유지)
        conn.execute(
            "DELETE FROM vision_metrics WHERE resource_id=? AND id NOT IN "
            "(SELECT id FROM vision_metrics WHERE resource_id=? ORDER BY id DESC LIMIT 2000)",
            (body.resource_id, body.resource_id),
        )
        data = publish_resource(conn, body.resource_id)
    return {"ok": True, "est_wait_min": est, "level": data.get("level")}
