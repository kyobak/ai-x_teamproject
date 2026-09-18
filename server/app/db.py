"""
SQLite 데이터 접근 계층.

왜 Supabase 대신 SQLite 인가 (docs/adr/0001 참고):
- 프로토타입은 "노트북 한 대로 시연" 이 목표입니다. 외부 계정·네트워크·비밀키 없이 `python -m uvicorn` 한 줄로 떠야 합니다.
- 팀원 4명이 코드를 전부 이해해야 하므로 ORM 없이 표준 라이브러리 sqlite3 + 평범한 SQL 을 씁니다.
- 스키마는 계획서의 데이터 모델을 그대로 따르므로, 나중에 Supabase(Postgres) 로 옮길 때 테이블 정의만 옮기면 됩니다.

시각은 전부 UTC ISO 문자열로 저장합니다. (화면에서 로컬 시간으로 바꿉니다)
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

from app import config

# ---------------------------------------------------------------------------
# 스키마. 계획서 "핵심 데이터 모델" 과 1:1. vision_metrics 에는 이미지·좌표를 넣을 칸 자체가 없습니다(저장 금지를 스키마로 강제).
# ---------------------------------------------------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS resources (
    id        TEXT PRIMARY KEY,           -- 예: cafeteria-1, laundry-w1
    kind      TEXT NOT NULL,              -- laundry | space | shuttle | cafeteria | parking
    zone      TEXT NOT NULL,              -- 건물/구역 이름
    name      TEXT NOT NULL,
    capacity  INTEGER,                    -- 셔틀 정원, 오픈스페이스 좌석 수 등
    source    TEXT NOT NULL,              -- 1순위 데이터 소스: vision | sensor | qr | admin | mock
    extra     TEXT NOT NULL DEFAULT '{}'  -- 종류별 부가 정보(JSON). 셔틀 시간표 등
);
CREATE TABLE IF NOT EXISTS vision_metrics (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id        TEXT NOT NULL,
    people_count       INTEGER NOT NULL,
    throughput_per_min REAL,              -- NULL = 통과선을 못 봐서 측정 불가 (REQ-VIS-05)
    est_wait_min       REAL,
    confidence         REAL NOT NULL,
    device_id          TEXT NOT NULL,
    created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vm_resource_time ON vision_metrics(resource_id, created_at DESC);
CREATE TABLE IF NOT EXISTS status_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id     TEXT NOT NULL,
    state           TEXT,                 -- 세탁기: available|in_use|unknown 등
    occupancy_level TEXT,                 -- relaxed|normal|crowded
    source          TEXT NOT NULL,        -- vision | report | admin | crawl | sensor
    created_at      TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS queue_tickets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT NOT NULL,
    device_id   TEXT NOT NULL,            -- 익명 기기 ID (학번 아님, REQ-SYS-01)
    position    INTEGER NOT NULL,
    status      TEXT NOT NULL,            -- waiting | called | done | expired | left
    created_at  TEXT NOT NULL,
    called_at   TEXT
);
CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT NOT NULL,
    level       INTEGER NOT NULL,         -- 1(여유) ~ 5(매우 혼잡)
    device_hash TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS predictions (
    resource_id     TEXT NOT NULL,
    weekday         INTEGER NOT NULL,     -- 0=월 ... 6=일
    time_slot       TEXT NOT NULL,        -- "HH:MM" 30분 단위
    predicted_level TEXT NOT NULL,
    model_version   TEXT NOT NULL,
    PRIMARY KEY (resource_id, weekday, time_slot)
);
CREATE TABLE IF NOT EXISTS machine_states (
    resource_id TEXT PRIMARY KEY,
    state_json  TEXT NOT NULL,            -- logic/laundry.MachineState 를 JSON 으로 직렬화
    updated_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sensor_samples (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT NOT NULL,
    magnitude   REAL NOT NULL,
    ts          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ss_resource_time ON sensor_samples(resource_id, ts DESC);
CREATE TABLE IF NOT EXISTS menus (
    resource_id TEXT NOT NULL,
    date        TEXT NOT NULL,            -- YYYY-MM-DD
    items       TEXT NOT NULL,            -- JSON 배열
    PRIMARY KEY (resource_id, date)
);
"""

# ---------------------------------------------------------------------------
# 시드 데이터: 데모에 필요한 자원 목록. 실제 학교 자원명은 조사 후 바꿉니다.
# ---------------------------------------------------------------------------
SEED_RESOURCES = [
    # 슬라이스 A: 학식 (Must)
    ("cafeteria-1", "cafeteria", "학생복지관 1층", "학생식당 한식 코너", None, "vision", {}),
    ("cafeteria-2", "cafeteria", "학생복지관 2층", "푸드코트", None, "report", {}),
    # Should: 셔틀 (같은 비전 모듈 재사용 + 시간표)
    ("shuttle-1", "shuttle", "셔틀콕", "셔틀콕 → 한대앞역", 45, "vision",
     {"timetable": ["08:00", "08:20", "08:40", "09:00", "09:20", "09:40", "10:00", "10:30", "11:00", "11:30",
                    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
                    "17:00", "17:20", "17:40", "18:00", "18:20", "18:40", "19:00", "19:30", "20:00", "21:00", "22:00"]}),
    # 슬라이스 B: 세탁실 (Must) — 진동 센서
    ("laundry-w1", "laundry", "창의인재원 A동 세탁실", "세탁기 1", None, "sensor", {"type": "washer"}),
    ("laundry-w2", "laundry", "창의인재원 A동 세탁실", "세탁기 2", None, "sensor", {"type": "washer"}),
    ("laundry-w3", "laundry", "창의인재원 A동 세탁실", "세탁기 3", None, "sensor", {"type": "washer"}),
    ("laundry-d1", "laundry", "창의인재원 A동 세탁실", "건조기 1", None, "sensor", {"type": "dryer"}),
    # Could: 목업
    ("space-1", "space", "공학관 3층", "오픈스페이스", 40, "admin", {}),
    ("parking-1", "parking", "정문", "정문 주차장", 120, "admin", {}),
]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def parse_iso(s: str | None) -> datetime | None:
    """DB 문자열 → datetime. 옛 데이터에 시간대가 없으면 UTC 로 간주합니다."""
    if not s:
        return None
    dt = datetime.fromisoformat(s)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@contextmanager
def get_conn():
    """요청마다 새 연결을 여는 컨텍스트 매니저. 예외 없이 끝나면 커밋, 예외면 롤백."""
    config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row      # 컬럼 이름으로 접근 가능 (row["name"])
    conn.execute("PRAGMA journal_mode=WAL")   # 읽기/쓰기 동시 접근에 유리
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """앱 시작 시 한 번: 테이블 생성 + 자원/예측/메뉴 시드."""
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        for rid, kind, zone, name, cap, source, extra in SEED_RESOURCES:
            conn.execute(
                "INSERT OR IGNORE INTO resources(id, kind, zone, name, capacity, source, extra) VALUES (?,?,?,?,?,?,?)",
                (rid, kind, zone, name, cap, source, json.dumps(extra, ensure_ascii=False)),
            )
        _seed_predictions(conn)
        _seed_menus(conn)


def _seed_predictions(conn: sqlite3.Connection) -> None:
    """시간대별 혼잡도 예측 초깃값. 실제로는 jobs/predict.py 가 과거 vision_metrics 로 다시 계산해 덮어씁니다.
    점심 피크(11:30~13:00)를 혼잡, 그 앞뒤를 보통, 나머지를 여유로 둡니다."""
    slots = [f"{h:02d}:{m:02d}" for h in range(7, 24) for m in (0, 30)]
    for rid in ("cafeteria-1", "cafeteria-2"):
        for wd in range(0, 7):  # 주말은 아래 규칙으로 여유/보통만 나옴
            for slot in slots:
                if wd >= 5:
                    lvl = "normal" if "11:30" <= slot <= "13:00" else "relaxed"
                elif "11:30" <= slot <= "13:00" or "17:30" <= slot <= "18:30":
                    lvl = "crowded"
                elif "11:00" <= slot <= "13:30" or "17:00" <= slot <= "19:00":
                    lvl = "normal"
                else:
                    lvl = "relaxed"
                conn.execute(
                    "INSERT OR IGNORE INTO predictions VALUES (?,?,?,?,?)",
                    (rid, wd, slot, lvl, "seed-v0"),
                )


def _seed_menus(conn: sqlite3.Connection) -> None:
    """오늘 메뉴 예시. jobs/crawl_menu.py 가 실제 페이지에서 가져와 갱신하는 것이 목표(robots.txt 확인 후)."""
    today = utcnow().astimezone().strftime("%Y-%m-%d")
    sample = {
        "cafeteria-1": [{"name": "제육볶음 정식", "price": 5500}, {"name": "된장찌개", "price": 5000}],
        "cafeteria-2": [{"name": "치킨마요 덮밥", "price": 6000}, {"name": "돈까스", "price": 6500}, {"name": "쌀국수", "price": 6000}],
    }
    for rid, items in sample.items():
        conn.execute(
            "INSERT OR IGNORE INTO menus(resource_id, date, items) VALUES (?,?,?)",
            (rid, today, json.dumps(items, ensure_ascii=False)),
        )


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    return dict(row) if row is not None else None
