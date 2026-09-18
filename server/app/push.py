"""
Web Push (VAPID) 발송.  관련 요구사항: REQ-LAU-04 (내 차례 알림 5초 이내)

왜 필요한가: 지금까지는 앱이 열려 있을 때만(SSE + 화면 배너) 알림이 됐습니다. 세탁물을 맡기고 방에 돌아간 학생에게
알림을 보내려면 브라우저가 닫혀 있어도 도착하는 Web Push 가 필요합니다.

동작:
1. 서버가 처음 뜰 때 VAPID 키 쌍을 server/data/vapid.pem 에 만듭니다 (없을 때만). 팀원마다 키가 달라도 됩니다.
2. 브라우저는 GET /api/push/public-key 로 공개키를 받아 PushManager.subscribe() 하고, 구독 정보를 POST /api/push/subscribe 로 보냅니다.
3. 대기열 호출 시 send_to_device() 가 그 기기의 모든 구독에 푸시를 보냅니다. 만료된 구독(410/404)은 지웁니다.

주의: iOS 는 "홈 화면에 추가" 한 PWA 에서만 푸시가 옵니다. localhost 는 HTTPS 없이도 동작하지만 휴대폰에서 노트북 IP 로 열면
Safari/Chrome 이 푸시 구독을 막을 수 있습니다(HTTPS 필요). 그 경우 화면 배너가 대체 경로입니다.
"""
from __future__ import annotations

import base64
import json
import sqlite3
import threading

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid
from pywebpush import WebPushException, webpush

from app import config

_vapid: Vapid | None = None


def get_vapid() -> Vapid:
    global _vapid
    if _vapid is None:
        path = config.VAPID_KEY_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            _vapid = Vapid.from_file(str(path))
        else:
            _vapid = Vapid()
            _vapid.generate_keys()
            _vapid.save_key(str(path))
    return _vapid


def public_key_b64url() -> str:
    """브라우저 PushManager.subscribe({applicationServerKey}) 에 넣을 형식 (base64url, 패딩 없음)."""
    raw = get_vapid().public_key.public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _send_one(sub: dict, payload: dict) -> bool:
    """구독 하나에 발송. False 면 구독이 죽은 것(삭제 대상)."""
    try:
        webpush(
            subscription_info=sub,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=str(config.VAPID_KEY_PATH),
            vapid_claims={"sub": config.VAPID_CLAIMS_SUB},
            ttl=60,
        )
        return True
    except WebPushException as e:
        status = getattr(e.response, "status_code", None)
        return status not in (404, 410)   # 404/410 = 구독 만료
    except Exception as e:  # 네트워크 오류 등은 로그만
        print("[push] send error:", e)
        return True


def send_to_device(device_id: str, payload: dict) -> None:
    """기기의 모든 구독에 비동기(스레드) 발송. 요청 처리를 막지 않기 위해 스레드로 뺍니다."""
    def worker():
        from app.db import get_conn   # 순환 임포트 방지
        with get_conn() as conn:
            rows = conn.execute("SELECT endpoint, keys FROM push_subs WHERE device_id=?", (device_id,)).fetchall()
            for r in rows:
                sub = {"endpoint": r["endpoint"], "keys": json.loads(r["keys"])}
                if not _send_one(sub, payload):
                    conn.execute("DELETE FROM push_subs WHERE endpoint=?", (r["endpoint"],))
    threading.Thread(target=worker, daemon=True).start()
