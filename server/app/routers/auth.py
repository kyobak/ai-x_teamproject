"""
계정 (닉네임 + 비밀번호). 학번·실명·이메일은 받지 않습니다 (REQ-SYS-01).

POST /api/auth/register   {nickname, password} → {token, nickname, prefs}
POST /api/auth/login      {nickname, password} → {token, ...}
GET  /api/auth/me         Authorization: Bearer <token>
PUT  /api/auth/me/prefs   내 정보 저장
POST /api/auth/logout     토큰 무효화

토큰은 무작위 32바이트를 URL-safe base64 로 만든 문자열이며 users.token 에 저장됩니다(프로토타입: 기기당 1개).
비밀번호는 PBKDF2-SHA256(20만 회) + salt 로 저장합니다. 평문 저장 금지.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets

from fastapi import APIRouter, Header, HTTPException

from app.db import get_conn, iso, utcnow
from app.models import AuthIn, PrefsIn

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _hash(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(8)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
    return f"{salt}${dk.hex()}"


def _verify(password: str, stored: str) -> bool:
    salt, _ = stored.split("$", 1)
    return hmac.compare_digest(_hash(password, salt), stored)


def _user_by_token(conn, authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "로그인이 필요합니다")
    row = conn.execute("SELECT * FROM users WHERE token=?", (authorization[7:],)).fetchone()
    if not row:
        raise HTTPException(401, "세션이 만료되었습니다. 다시 로그인하세요")
    return row


def _public(row) -> dict:
    return {"nickname": row["nickname"], "prefs": json.loads(row["prefs"] or "{}"), "created_at": row["created_at"]}


@router.post("/register")
async def register(body: AuthIn):
    with get_conn() as conn:
        if conn.execute("SELECT 1 FROM users WHERE nickname=?", (body.nickname,)).fetchone():
            raise HTTPException(409, "이미 사용 중인 닉네임입니다")
        token = secrets.token_urlsafe(32)
        conn.execute("INSERT INTO users(nickname, password_hash, token, prefs, created_at) VALUES (?,?,?,?,?)",
                     (body.nickname, _hash(body.password), token, "{}", iso(utcnow())))
        row = conn.execute("SELECT * FROM users WHERE nickname=?", (body.nickname,)).fetchone()
    return {"token": token, **_public(row)}


@router.post("/login")
async def login(body: AuthIn):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE nickname=?", (body.nickname,)).fetchone()
        if not row or not _verify(body.password, row["password_hash"]):
            raise HTTPException(401, "닉네임 또는 비밀번호가 틀립니다")
        token = secrets.token_urlsafe(32)
        conn.execute("UPDATE users SET token=? WHERE id=?", (token, row["id"]))
    return {"token": token, **_public(row)}


@router.get("/me")
async def me(authorization: str | None = Header(default=None)):
    with get_conn() as conn:
        return _public(_user_by_token(conn, authorization))


@router.put("/me/prefs")
async def save_prefs(body: PrefsIn, authorization: str | None = Header(default=None)):
    with get_conn() as conn:
        row = _user_by_token(conn, authorization)
        conn.execute("UPDATE users SET prefs=? WHERE id=?", (json.dumps(body.model_dump(), ensure_ascii=False), row["id"]))
        row = conn.execute("SELECT * FROM users WHERE id=?", (row["id"],)).fetchone()
        return _public(row)


@router.post("/logout")
async def logout(authorization: str | None = Header(default=None)):
    with get_conn() as conn:
        row = _user_by_token(conn, authorization)
        conn.execute("UPDATE users SET token=NULL WHERE id=?", (row["id"],))
    return {"ok": True}
