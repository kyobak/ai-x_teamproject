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
from app.config import BASE_DIR

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
CREATE TABLE IF NOT EXISTS push_subs (
    endpoint    TEXT PRIMARY KEY,
    device_id   TEXT NOT NULL,
    keys        TEXT NOT NULL,            -- {"p256dh":..., "auth":...}
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_device ON push_subs(device_id);
CREATE TABLE IF NOT EXISTS checkins (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id    TEXT NOT NULL,
    device_id      TEXT NOT NULL,
    checked_in_at  TEXT NOT NULL,
    checked_out_at TEXT                   -- NULL = 재실 중
);
CREATE INDEX IF NOT EXISTS idx_checkins_open ON checkins(resource_id, checked_out_at);
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname      TEXT NOT NULL UNIQUE,     -- 닉네임만. 학번·실명은 받지 않음 (REQ-SYS-01)
    password_hash TEXT NOT NULL,            -- PBKDF2-SHA256, salt 포함
    token         TEXT,                     -- 로그인 토큰 (Bearer)
    prefs         TEXT NOT NULL DEFAULT '{}',   -- 기숙사 동, 자주 가는 식당, 알림 설정 등 (JSON)
    created_at    TEXT NOT NULL
);
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
# 세탁실: 기숙사 3개 관. 팀 조사 결과 세탁기 인재관 3·창의관 6·행복관 3, 건조기도 같은 수.
LAUNDRY_BUILDINGS = [("injae", "인재관", 3), ("changui", "창의관", 6), ("haengbok", "행복관", 3)]


def _laundry_resources() -> list[tuple]:
    out = []
    for key, name, n in LAUNDRY_BUILDINGS:
        for i in range(1, n + 1):
            out.append((f"laundry-{key}-w{i}", "laundry", f"{name} 세탁실", f"세탁기 {i}", None, "sensor", {"type": "washer", "building": key}))
        for i in range(1, n + 1):
            out.append((f"laundry-{key}-d{i}", "laundry", f"{name} 세탁실", f"건조기 {i}", None, "sensor", {"type": "dryer", "building": key}))
    return out


# 오픈스페이스: 단과대·건물별 5곳. 정원은 목업(현장 확인 후 수정).
SPACES = [("space-yunghap", "융합교육관", "융합교육관 오픈스페이스", 60), ("space-gym", "체육관", "체육관 라운지", 40),
          ("space-gyeongsang", "경상관", "경상관 오픈스페이스", 50), ("space-solseong", "솔성관", "솔성관 오픈스페이스", 40),
          ("space-gwagi", "과학기술대학", "과기대 오픈스페이스", 50)]

# 셔틀: 정류장·방향별 자원. 시간표는 jobs/data/shuttle_timetable.json (직접 노선 기준 소요: 창의인재원→셔틀콕 5분, 셔틀콕→한대앞역 10분).
SHUTTLES = [("shuttle-shuttlecock-hanyang", "셔틀콕", "셔틀콕 → 한대앞역", "shuttlecock_to_hanyang"),
            ("shuttle-residence-shuttlecock", "창의인재원", "창의인재원 → 셔틀콕", "residence_to_shuttlecock"),
            ("shuttle-hanyang-campus", "한대앞역", "한대앞역 → 셔틀콕·창의인재원", "hanyang_to_shuttlecock"),
            ("shuttle-shuttlecock-apt", "셔틀콕", "셔틀콕 → 예술인APT", "shuttlecock_to_apt"),
            ("shuttle-apt-campus", "예술인APT", "예술인APT → 셔틀콕·창의인재원", "apt_to_shuttlecock")]

SEED_RESOURCES = (
    _laundry_resources()
    + [(rid, "space", zone, name, cap, "qr", {}) for rid, zone, name, cap in SPACES]
    # 셔틀콕→한대앞역만 카메라 1순위(학식 비전 모듈 재사용), 나머지는 제보/데모
    + [(rid, "shuttle", zone, name, 45, "vision" if i == 0 else "report", {"direction": d}) for i, (rid, zone, name, d) in enumerate(SHUTTLES)]
    + [("parking-1", "parking", "정문", "정문 주차장", 120, "admin", {})]
)


def _clean_hours(t: str | None) -> str:
    return " / ".join(x.strip(" ·") for x in (t or "").replace("\r", "").split("\n") if x.strip()) or "운영시간 정보 없음"


def _food_resources() -> list[tuple]:
    """복지포털 시설안내 데이터로 학식 자원을 만듭니다.
    - 구내식당(4곳) → cafeteria-1..4. 학생식당은 카메라 1순위(슬라이스 A), 나머지는 제보/예측.
    - 학생복지관 2층의 일반음식점·카페 → foodcourt-1 의 입점 매장(vendors).
    - 창의관 1층 구내식당 내 매장 → foodcourt-2.
    데이터 파일이 없으면 최소 시드 2개로 대체합니다."""
    data_file = BASE_DIR.parent / "jobs" / "data" / "campus_food.json"
    fallback = [
        ("cafeteria-1", "cafeteria", "학생복지관 2층", "학생식당", None, "vision", {"hours": "중식 11:30~13:30", "site_name": "학생식당"}),
        ("foodcourt-1", "cafeteria", "학생복지관 2층", "푸드코트", None, "report", {"hours": "10:00~19:30", "vendors": []}),
    ]
    if not data_file.exists():
        return fallback
    try:
        fac = json.loads(data_file.read_text(encoding="utf-8")).get("facilities", [])
    except ValueError:
        return fallback
    if not fac:
        return fallback
    # 메뉴 데이터의 식당 이름(mock-data.js)과 시설안내의 이름이 다른 경우 매핑
    menu_name = {"창의인재원식당": "창의관식당"}
    order = ["학생식당", "창의인재원식당", "교직원식당", "창업보육센터식당"]
    canteens = sorted([f for f in fac if f["category"] == "구내식당"], key=lambda f: order.index(f["name"]) if f["name"] in order else 9)
    out = []
    for i, f in enumerate(canteens, start=1):
        out.append((f"cafeteria-{i}", "cafeteria", f["location"] or "", f["name"], None, "vision" if i == 1 else "report",
                    {"hours": _clean_hours(f["operating_time"]), "site_name": menu_name.get(f["name"], f["name"]),
                     "building_no": f.get("facility_no"), "contact": f.get("contact") or None}))
    def vendors(pred):
        return [{"name": f["name"], "category": "카페" if f["category"].startswith("카페") else "식당",
                 "hours": _clean_hours(f["operating_time"]), "contact": f.get("contact") or None}
                for f in fac if f["category"] in ("일반음식점", "카페/베이커리") and pred(f["location"] or "")]
    v1 = vendors(lambda loc: "학생복지관 2" in loc)
    v2 = vendors(lambda loc: "창의관 1층" in loc)
    out.append(("foodcourt-1", "cafeteria", "학생복지관 2층", "푸드코트 (학생복지관)", None, "report",
                {"hours": "매장별 상이 (대체로 10:00~19:30)", "vendors": v1, "building_no": "102"}))
    if v2:
        out.append(("foodcourt-2", "cafeteria", "창의관 1층", "창의관 푸드코트", None, "report",
                    {"hours": "매장별 상이", "vendors": v2, "building_no": "501"}))
    return out


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


def _migrate(conn: sqlite3.Connection) -> None:
    """기존 DB 에 새 컬럼을 추가하는 간단한 마이그레이션. 이미 있으면 건너뜁니다."""
    cols = {row[1] for row in conn.execute("PRAGMA table_info(vision_metrics)")}
    if "avg_dwell_sec" not in cols:
        conn.execute("ALTER TABLE vision_metrics ADD COLUMN avg_dwell_sec REAL")
    if "zone_type" not in cols:
        conn.execute("ALTER TABLE vision_metrics ADD COLUMN zone_type TEXT")


def init_db() -> None:
    """앱 시작 시 한 번: 테이블 생성 + 마이그레이션 + 자원/예측/메뉴 시드."""
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        _migrate(conn)
        for rid, kind, zone, name, cap, source, extra in _food_resources() + SEED_RESOURCES:
            # 시드 자원은 upsert: 코드에서 이름·구역·extra 를 고치면 기존 DB 에도 반영됩니다. (관리자가 등록한 다른 id 는 건드리지 않음)
            conn.execute(
                "INSERT INTO resources(id, kind, zone, name, capacity, source, extra) VALUES (?,?,?,?,?,?,?) "
                "ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, zone=excluded.zone, name=excluded.name, "
                "capacity=excluded.capacity, source=excluded.source, extra=excluded.extra",
                (rid, kind, zone, name, cap, source, json.dumps(extra, ensure_ascii=False)),
            )
        _seed_predictions(conn)
        _seed_menus(conn)


def _seed_predictions(conn: sqlite3.Connection) -> None:
    """시간대별 혼잡도 예측 초깃값. 실제로는 jobs/predict.py 가 과거 vision_metrics 로 다시 계산해 덮어씁니다.
    점심 피크(11:30~13:00)를 혼잡, 그 앞뒤를 보통, 나머지를 여유로 둡니다."""
    slots = [f"{h:02d}:{m:02d}" for h in range(7, 24) for m in (0, 30)]
    # 학식 종류의 모든 자원(구내식당 4곳 + 푸드코트)에 시드. 자원 시드가 먼저 실행된 뒤 호출됩니다.
    cafeterias = [r["id"] for r in conn.execute("SELECT id FROM resources WHERE kind='cafeteria'").fetchall()]
    for rid in cafeterias:
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
    """오늘 메뉴 시드. jobs/data/campus_food.json (복지포털 공개 데이터를 jobs/crawl_menu.py 가 저장) 이 있으면 그것을 쓰고,
    없으면 예시 두 줄. 크롤러를 하루 한 번 돌리면 이 값이 덮어써집니다."""
    today = utcnow().astimezone().strftime("%Y-%m-%d")
    sample: dict[str, list] = {
        "cafeteria-1": [{"name": "제육볶음 정식", "price": 5500}, {"name": "된장찌개", "price": 5000}],
        "cafeteria-2": [{"name": "치킨마요 덮밥", "price": 6000}],
    }
    data_file = BASE_DIR.parent / "jobs" / "data" / "campus_food.json"
    if data_file.exists():
        try:
            rest = {r["name"]: r["menus"] for r in json.loads(data_file.read_text(encoding="utf-8")).get("restaurants", [])}
            mapping = {rid: extra.get("site_name", name) for rid, kind, zone, name, cap, src, extra in _food_resources() if kind == "cafeteria"}
            sample = {rid: [{"name": m["course"], "price": m["price"], "meal": m["mealTime"], "items": m["items"]}
                            for m in rest.get(sname, [])] for rid, sname in mapping.items()}
        except (ValueError, KeyError) as e:
            print("[seed] campus_food.json 파싱 실패, 예시 메뉴 사용:", e)
    for rid, items in sample.items():
        conn.execute(
            "INSERT OR REPLACE INTO menus(resource_id, date, items) VALUES (?,?,?)",
            (rid, today, json.dumps(items, ensure_ascii=False)),
        )


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    return dict(row) if row is not None else None
