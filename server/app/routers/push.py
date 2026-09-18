"""
GET  /api/push/public-key       VAPID 공개키 (브라우저 구독용)
POST /api/push/subscribe        구독 저장
POST /api/push/unsubscribe      구독 삭제
POST /api/push/test             내 기기로 테스트 푸시 (설정 확인용)
"""
from __future__ import annotations

import json

from fastapi import APIRouter

from app import push
from app.db import get_conn, iso, utcnow
from app.models import PushSubscribeIn

router = APIRouter(prefix="/api/push", tags=["push"])


@router.get("/public-key")
async def public_key():
    return {"public_key": push.public_key_b64url()}


@router.post("/subscribe")
async def subscribe(body: PushSubscribeIn):
    sub = body.subscription
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO push_subs(endpoint, device_id, keys, created_at) VALUES (?,?,?,?)",
            (sub["endpoint"], body.device_id, json.dumps(sub.get("keys", {})), iso(utcnow())),
        )
    return {"ok": True}


@router.post("/unsubscribe")
async def unsubscribe(body: PushSubscribeIn):
    with get_conn() as conn:
        conn.execute("DELETE FROM push_subs WHERE endpoint=?", (body.subscription["endpoint"],))
    return {"ok": True}


@router.post("/test")
async def test_push(body: dict):
    push.send_to_device(body.get("device_id", ""), {"title": "테스트 알림", "body": "푸시가 정상 동작합니다.", "url": "/laundry"})
    return {"ok": True}
