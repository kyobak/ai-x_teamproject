"""
FastAPI 앱 진입점.

실행:  .venv/bin/python -m uvicorn app.main:app --app-dir server --reload --host 0.0.0.0 --port 8000
문서:  http://localhost:8000/docs  (모든 API 를 브라우저에서 바로 실행해 볼 수 있음)

--host 0.0.0.0 은 같은 와이파이의 휴대폰에서 노트북 IP 로 접속하기 위함입니다.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import get_conn, init_db, utcnow
from app.logic import laundry as L
from app.routers import admin, laundry, reports, resources, stream, vision
from app.services import load_machine_state, process_queue, publish_resource, save_machine_state


async def periodic_housekeeping() -> None:
    """20초마다: 세탁기 신호 끊김 검사(REQ-LAU-07), 호출 만료·다음 호출(REQ-LAU-05).
    샘플이 '안 오는' 상황은 요청 처리로는 감지할 수 없으므로 이런 주기 작업이 필요합니다."""
    while True:
        try:
            now = utcnow()
            with get_conn() as conn:
                for r in conn.execute("SELECT id FROM resources WHERE kind='laundry'").fetchall():
                    st = load_machine_state(conn, r["id"])
                    st, ev = L.mark_stale_if_needed(st, now)
                    if ev:
                        save_machine_state(conn, r["id"], st)
                    process_queue(conn, r["id"], now)
                    if ev:
                        publish_resource(conn, r["id"])
                # 학식은 60초 무신호 시 대체값 표시가 되어야 하므로, 주기적으로 상태를 다시 보냅니다.
                for r in conn.execute("SELECT id FROM resources WHERE kind IN ('cafeteria','shuttle')").fetchall():
                    publish_resource(conn, r["id"])
        except Exception as e:  # 주기 작업이 죽으면 대기열 만료가 멈추므로 로그만 남기고 계속
            print("[housekeeping] error:", e)
        await asyncio.sleep(20)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    task = asyncio.create_task(periodic_housekeeping())
    yield
    task.cancel()


app = FastAPI(title="ERICA 캠퍼스 대기 통합 서비스 API", version="0.1.0", lifespan=lifespan)

# 개발 중엔 어느 출처(휴대폰, Vercel 미리보기 등)에서든 호출 가능하게 엽니다. 배포 시엔 도메인을 제한합니다.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

for r in (resources.router, vision.router, laundry.router, reports.router, admin.router, stream.router):
    app.include_router(r)


@app.get("/api/health")
async def health():
    return {"ok": True, "time": utcnow().isoformat()}
