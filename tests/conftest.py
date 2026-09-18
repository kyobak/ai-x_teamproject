"""
pytest 공통 설정.

- DB_PATH 를 임시 파일로 바꿔 실제 data/app.db 를 건드리지 않습니다. (config 가 import 시점에 읽으므로 import 전에 설정)
- sys.path 에 server/ 를 넣어 `from app...` 임포트가 되게 합니다.
"""
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

_tmp = tempfile.mkdtemp()
os.environ["DB_PATH"] = str(Path(_tmp) / "test.db")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.db import init_db  # noqa: E402


@pytest.fixture()
def client():
    """각 테스트마다 깨끗한 DB 로 시작하는 HTTP 클라이언트."""
    db = Path(os.environ["DB_PATH"])
    for suffix in ("", "-wal", "-shm"):
        p = Path(str(db) + suffix)
        if p.exists():
            p.unlink()
    init_db()
    with TestClient(app) as c:
        yield c
