"""
GET /api/resources          대시보드: 모든 자원의 현재 상태
GET /api/resources/{id}     상세 화면
GET /api/resources/{id}/history   최근 영상 수치/센서 샘플 (그래프용)
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.db import get_conn
from app.services import build_resource_status

router = APIRouter(prefix="/api/resources", tags=["resources"])


@router.get("")
async def list_resources():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM resources ORDER BY kind, id").fetchall()
        return [build_resource_status(conn, r) for r in rows]


@router.get("/{resource_id}")
async def get_resource(resource_id: str):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM resources WHERE id=?", (resource_id,)).fetchone()
        if not row:
            raise HTTPException(404, "resource not found")
        return build_resource_status(conn, row)


@router.get("/{resource_id}/history")
async def get_history(resource_id: str, limit: int = 60):
    """최근 수치들. 학식은 vision_metrics, 세탁기는 sensor_samples. 화면의 미니 그래프에 씁니다."""
    with get_conn() as conn:
        row = conn.execute("SELECT kind FROM resources WHERE id=?", (resource_id,)).fetchone()
        if not row:
            raise HTTPException(404, "resource not found")
        if row["kind"] == "laundry":
            rows = conn.execute(
                "SELECT magnitude, ts FROM sensor_samples WHERE resource_id=? ORDER BY ts DESC LIMIT ?", (resource_id, limit)
            ).fetchall()
            return [dict(r) for r in reversed(rows)]
        rows = conn.execute(
            "SELECT people_count, throughput_per_min, est_wait_min, confidence, created_at FROM vision_metrics "
            "WHERE resource_id=? ORDER BY created_at DESC LIMIT ?", (resource_id, limit)
        ).fetchall()
        return [dict(r) for r in reversed(rows)]
