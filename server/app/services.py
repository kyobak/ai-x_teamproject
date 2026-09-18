"""
라우터들이 공통으로 쓰는 "조립" 함수.

- build_resource_status(): 자원 하나의 현재 상태를 여러 테이블에서 모아 화면용 dict 로 만듭니다.
- 세탁기 상태(MachineState) 를 DB 에 저장/복원합니다.
- 대기열 호출/만료를 처리하고 이벤트를 발행합니다.

logic/ 의 순수 함수와 db.py 사이를 잇는 층입니다. 라우터는 얇게, 규칙은 logic 에, 조립은 여기에.
"""
from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict
from datetime import datetime, timedelta

from app import config
from app.db import iso, parse_iso, row_to_dict, utcnow
from app.events import bus
from app import push
from app.logic import demo as D
from app.logic import laundry as L
from app.logic import queue as Q
from app.logic import shuttle as S
from app.logic import wait_time as W

LEVEL_KO = {"relaxed": "여유", "normal": "보통", "crowded": "혼잡", "unknown": "알 수 없음"}
REPORT_LEVEL_TO_TEXT = {1: "relaxed", 2: "relaxed", 3: "normal", 4: "crowded", 5: "crowded"}


# ---------------------------------------------------------------------------
# 세탁기 상태 저장/복원
# ---------------------------------------------------------------------------
def load_machine_state(conn: sqlite3.Connection, resource_id: str) -> L.MachineState:
    row = conn.execute("SELECT state_json FROM machine_states WHERE resource_id=?", (resource_id,)).fetchone()
    if not row:
        return L.MachineState()
    d = json.loads(row["state_json"])
    for k in ("vib_started_at", "last_vibration_at", "last_sample_at", "in_use_since", "expected_end_at"):
        d[k] = parse_iso(d.get(k))
    return L.MachineState(**d)


def save_machine_state(conn: sqlite3.Connection, resource_id: str, st: L.MachineState) -> None:
    d = asdict(st)
    for k in ("vib_started_at", "last_vibration_at", "last_sample_at", "in_use_since", "expected_end_at"):
        d[k] = iso(d[k])
    conn.execute(
        "INSERT INTO machine_states(resource_id, state_json, updated_at) VALUES (?,?,?) "
        "ON CONFLICT(resource_id) DO UPDATE SET state_json=excluded.state_json, updated_at=excluded.updated_at",
        (resource_id, json.dumps(d), iso(utcnow())),
    )


# ---------------------------------------------------------------------------
# 대기열
# ---------------------------------------------------------------------------
def live_tickets(conn: sqlite3.Connection, resource_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM queue_tickets WHERE resource_id=? AND status IN ('waiting','called') ORDER BY position",
        (resource_id,),
    ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["called_at"] = parse_iso(d["called_at"])
        out.append(d)
    return out


def process_queue(conn: sqlite3.Connection, resource_id: str, now: datetime | None = None) -> None:
    """만료 → 호출 순으로 대기열을 한 번 정리합니다.
    기기가 available 일 때만 호출하고, unknown 이면 호출하지 않습니다 (REQ-LAU-04/05/07).
    세탁기 상태가 바뀔 때와 주기 작업(main.py)에서 호출됩니다."""
    now = now or utcnow()
    tickets = live_tickets(conn, resource_id)

    # 1) 호출 후 5분이 지난 티켓 만료 (REQ-LAU-05)
    for t in Q.expired_calls(tickets, now):
        conn.execute("UPDATE queue_tickets SET status='expired' WHERE id=?", (t["id"],))
        bus.publish("queue_expired", {"resource_id": resource_id, "device_id": t["device_id"]})
    tickets = live_tickets(conn, resource_id)

    # 2) 기기가 비어 있으면 다음 순번 호출 (REQ-LAU-04)
    st = load_machine_state(conn, resource_id)
    if st.state != L.AVAILABLE:
        return
    nxt = Q.next_to_call(tickets)
    if nxt:
        conn.execute("UPDATE queue_tickets SET status='called', called_at=? WHERE id=?", (iso(now), nxt["id"]))
        # 화면은 이 이벤트를 받아 알림(Notification API)을 띄웁니다. 5초 이내 도달이 목표(REQ-LAU-04).
        bus.publish("queue_called", {"resource_id": resource_id, "device_id": nxt["device_id"],
                                     "timeout_min": config.QUEUE_CALL_TIMEOUT_MINUTES})
        # 앱이 닫혀 있어도 도착하도록 Web Push 도 같이 보냅니다 (구독이 없으면 아무 일도 안 함).
        name = conn.execute("SELECT name FROM resources WHERE id=?", (resource_id,)).fetchone()["name"]
        push.send_to_device(nxt["device_id"], {"title": f"{name} 이(가) 비었습니다",
                                               "body": f"{config.QUEUE_CALL_TIMEOUT_MINUTES}분 안에 사용을 시작하지 않으면 다음 순번으로 넘어갑니다.",
                                               "url": "/laundry"})


# ---------------------------------------------------------------------------
# 자원 상태 조립
# ---------------------------------------------------------------------------
def _latest_vision(conn: sqlite3.Connection, resource_id: str) -> dict | None:
    return row_to_dict(conn.execute(
        "SELECT * FROM vision_metrics WHERE resource_id=? ORDER BY created_at DESC LIMIT 1", (resource_id,)
    ).fetchone())


def _report_level(conn: sqlite3.Connection, resource_id: str, now: datetime) -> tuple[str | None, int]:
    """유효한(만료 전) 제보들의 평균 → 3단계. 제보 수도 같이 돌려 화면에 '제보 n건' 표시."""
    rows = conn.execute(
        "SELECT level FROM reports WHERE resource_id=? AND expires_at > ?", (resource_id, iso(now))
    ).fetchall()
    if not rows:
        return None, 0
    avg = sum(r["level"] for r in rows) / len(rows)
    return REPORT_LEVEL_TO_TEXT[max(1, min(5, round(avg)))], len(rows)


def _prediction_level(conn: sqlite3.Connection, resource_id: str, now_local: datetime) -> str | None:
    slot = f"{now_local.hour:02d}:{'30' if now_local.minute >= 30 else '00'}"
    row = conn.execute(
        "SELECT predicted_level FROM predictions WHERE resource_id=? AND weekday=? AND time_slot=?",
        (resource_id, now_local.weekday(), slot),
    ).fetchone()
    return row["predicted_level"] if row else None


def _latest_admin(conn: sqlite3.Connection, resource_id: str, now: datetime) -> dict | None:
    """관리자 입력은 30분만 유효. 오래된 수동 입력이 영원히 남지 않게 합니다."""
    row = conn.execute(
        "SELECT * FROM status_events WHERE resource_id=? AND source='admin' AND created_at > ? ORDER BY created_at DESC LIMIT 1",
        (resource_id, iso(now - timedelta(minutes=30))),
    ).fetchone()
    return row_to_dict(row)


def _menu_today(conn: sqlite3.Connection, resource_id: str) -> list:
    today = utcnow().astimezone(config.LOCAL_TZ).strftime("%Y-%m-%d")
    row = conn.execute("SELECT items FROM menus WHERE resource_id=? AND date=?", (resource_id, today)).fetchone()
    return json.loads(row["items"]) if row else []


def _next_departures(timetable: list[str], now_local: datetime, n: int = 3) -> list[str]:
    hhmm = now_local.strftime("%H:%M")
    upcoming = [t for t in timetable if t >= hhmm]
    return upcoming[:n]


def build_resource_status(conn: sqlite3.Connection, res: sqlite3.Row | dict, now: datetime | None = None) -> dict:
    """자원 한 개의 화면용 상태. kind 별로 다른 정보를 붙입니다."""
    now = now or utcnow()
    now_local = now.astimezone(config.LOCAL_TZ)
    r = dict(res)
    extra = json.loads(r.get("extra") or "{}")
    out = {
        "id": r["id"], "kind": r["kind"], "zone": r["zone"], "name": r["name"],
        "capacity": r["capacity"], "primary_source": r["source"], "updated_at": iso(now),
    }

    if r["kind"] in ("cafeteria", "shuttle"):
        vm = _latest_vision(conn, r["id"])
        rep_level, rep_count = _report_level(conn, r["id"], now)
        adm = _latest_admin(conn, r["id"], now)
        status = W.resolve_status(
            now=now,
            vision_count=vm["people_count"] if vm else None,
            vision_throughput=vm["throughput_per_min"] if vm else None,
            vision_confidence=vm["confidence"] if vm else None,
            vision_seen_at=parse_iso(vm["created_at"]) if vm else None,
            report_level=rep_level,
            prediction_level=_prediction_level(conn, r["id"], now_local),
            admin_level=adm["occupancy_level"] if adm else None,
        )
        # 데모 모드: 실측·관리자·제보가 전혀 없으면 예측값 대신 시연용 가상 수치를 씁니다 (source="demo").
        if config.DEMO_MODE and status.source in ("prediction", "none"):
            d = D.shuttle(r["id"], now_local) if r["kind"] == "shuttle" else D.cafeteria(r["id"], now_local)
            thr = d["throughput_per_min"] or W.fallback_throughput(now_local)
            wait = W.estimate_wait_minutes(d["people_count"], thr)
            status = W.ResolvedStatus(d["people_count"], thr, wait, W.classify_level(wait), "demo", "시연용 시뮬레이션 값 (카메라 연결 전)")
            vm = {"created_at": iso(now), "confidence": d["confidence"]}
        out.update({
            "avg_dwell_sec": vm.get("avg_dwell_sec") if vm else None,
            "people_count": status.people_count,
            "throughput_per_min": status.throughput_per_min,
            "est_wait_min": status.est_wait_min,
            "level": status.level,
            "level_ko": LEVEL_KO.get(status.level, "알 수 없음"),
            "source": status.source,
            "note": status.note,
            "report_count": rep_count,
            "vision_seen_at": vm["created_at"] if vm else None,
            "confidence": vm["confidence"] if vm else None,
        })
        if r["kind"] == "cafeteria":
            out["menu"] = _menu_today(conn, r["id"])
            out["vendors"] = extra.get("vendors", [])      # 푸드코트 입점 매장 (resources.extra)
            out["hours"] = extra.get("hours")               # 운영 시간 문자열
        else:
            direction = extra.get("direction", "")
            ups = S.upcoming(direction, now_local, n=4)
            board = S.boarding(direction, now_local, status.people_count, r["capacity"])
            out["direction"] = direction
            out["upcoming"] = ups                                   # [{time, in_min}]
            out["next_departures"] = [u["time"] for u in ups]
            out["next_in_min"] = ups[0]["in_min"] if ups else None
            out["buses_to_wait"] = board["buses_to_wait"]
            out["board_time"] = board["board_time"]
            out["board_in_min"] = board["board_in_min"]
            out["board_note"] = board["note"]
            out["travel_min"] = S.travel_minutes(direction)

    elif r["kind"] == "laundry":
        st = load_machine_state(conn, r["id"])
        st, _ = L.mark_stale_if_needed(st, now)
        info = L.display_info(st, now)
        tickets = live_tickets(conn, r["id"])
        src = "sensor"
        if config.DEMO_MODE and st.last_sample_at is None:
            # 센서가 한 번도 붙지 않은 기기: 시연용 가상 사이클 (source="demo"). 대기열 호출은 실제 센서/관리자 입력에서만 일어남.
            dm = D.laundry(r["id"], now)
            st.state, st.in_use_since, st.expected_end_at = dm["state"], dm["in_use_since"], dm["expected_end_at"]
            info = L.display_info(st, now)
            src = "demo"
        out.update({
            "building": extra.get("building"),
            "source": src,
            "note": "시연용 시뮬레이션 값 (센서 연결 전)" if src == "demo" else "진동 센서 실측",
            "machine_type": extra.get("type", "washer"),
            "state": st.state,
            "state_label": info["label"],
            "remaining_min": info["remaining_min"],
            "overdue": info["overdue"],
            "in_use_since": iso(st.in_use_since),
            "expected_end_at": iso(st.expected_end_at),
            "last_sample_at": iso(st.last_sample_at),
            "queue_length": len(tickets),
            "avg_cycle_min": round(sum(st.cycle_history_min[-5:]) / len(st.cycle_history_min[-5:]), 1) if st.cycle_history_min else None,
        })

    elif r["kind"] == "space" and r["source"] == "qr":
        # 오픈스페이스: QR 체크인 수(퇴실 안 한 사람)로 재실 인원 계산. 관리자 입력이 최근 30분 안에 있으면 그것을 우선.
        adm = _latest_admin(conn, r["id"], now)
        count = conn.execute(
            "SELECT COUNT(*) FROM checkins WHERE resource_id=? AND checked_out_at IS NULL", (r["id"],)
        ).fetchone()[0]
        vm = _latest_vision(conn, r["id"])
        if adm and adm["state"] and adm["state"].isdigit():
            count, src, note = int(adm["state"]), "admin", "관리자 수동 입력 (30분간 유효)"
        elif vm and W.is_vision_usable(parse_iso(vm["created_at"]), vm["confidence"], now):
            # 실내 카메라가 재실 인원을 세는 경우 (zone_type=room). 영상은 저장하지 않고 숫자만.
            count, src, note = vm["people_count"], "vision", "카메라 재실 인원 계수"
            out["vision_seen_at"] = vm["created_at"]
        elif count == 0 and config.DEMO_MODE:
            count, src, note = D.space(r["id"], now_local, r["capacity"]), "demo", "시연용 시뮬레이션 값 (QR 체크인 전)"
        else:
            src, note = "qr", "입구 QR 체크인 집계 · 퇴실을 안 찍으면 4시간 뒤 자동 퇴실"
        ratio = (count / r["capacity"]) if r["capacity"] else 0
        level = "relaxed" if ratio < 0.5 else "normal" if ratio < 0.85 else "crowded"
        out.update({"occupancy_count": count, "level": level, "level_ko": LEVEL_KO[level], "source": src, "note": note})

    else:  # parking 등 (Could: 관리자 입력/목업)
        adm = _latest_admin(conn, r["id"], now)
        row = conn.execute(
            "SELECT * FROM status_events WHERE resource_id=? AND source='admin' ORDER BY created_at DESC LIMIT 1", (r["id"],)
        ).fetchone()
        count = None
        if row and row["state"] and row["state"].isdigit():
            count = int(row["state"])
        level = adm["occupancy_level"] if adm and adm["occupancy_level"] else "unknown"
        src, note = ("admin", "관리자 수동 입력 (목업)") if row else ("none", "데이터 없음 (Could 범위)")
        if count is None and config.DEMO_MODE:
            count = D.parking(r["id"], now_local, r["capacity"])
            ratio = count / r["capacity"] if r["capacity"] else 0
            level = "relaxed" if ratio < 0.5 else "normal" if ratio < 0.85 else "crowded"
            src, note = "demo", "시연용 시뮬레이션 값 (주차관제 연동 전)"
        out.update({
            "occupancy_count": count, "level": level, "level_ko": LEVEL_KO.get(level, "알 수 없음"), "source": src, "note": note,
        })
    return out


def publish_resource(conn: sqlite3.Connection, resource_id: str) -> dict:
    """자원 상태를 다시 조립해 모든 접속자에게 보냅니다."""
    row = conn.execute("SELECT * FROM resources WHERE id=?", (resource_id,)).fetchone()
    data = build_resource_status(conn, row)
    bus.publish("resource_updated", data)
    return data
