"""
설정값 모음.

왜 한 파일에 모았나:
- 계획서에서 "값을 비워두고 실측 후 채운다"고 한 상수(50분, T=5분 등)가 여기 있습니다.
- 5주차/9주차 실측 뒤 숫자를 바꿀 때 코드 여기저기를 뒤지지 않고 이 파일만 고치면 됩니다.
- 환경변수(.env)로도 덮어쓸 수 있어 노트북/라즈베리파이/배포 환경마다 다른 값을 쓸 수 있습니다.
"""
import os
from pathlib import Path
from zoneinfo import ZoneInfo

# ---------- 시간대 ----------
# 시간표·식단 날짜·시간대 예측은 "한국 시각" 기준이어야 합니다. 배포 서버(Render/Fly)는 UTC 로 돌기 때문에
# 서버의 로컬 시간을 쓰면 9시간이 어긋납니다(실제로 겪은 버그). 그래서 모든 "현지 시각" 계산은 이 시간대를 씁니다.
LOCAL_TZ = ZoneInfo(os.getenv("APP_TZ", "Asia/Seoul"))

# ---------- 경로 ----------
# DB 파일은 server/ 폴더 옆 data/ 에 둡니다. .gitignore 에 포함되어 있어 커밋되지 않습니다.
BASE_DIR = Path(__file__).resolve().parent.parent          # server/
DATA_DIR = BASE_DIR / "data"
DB_PATH = Path(os.getenv("DB_PATH", DATA_DIR / "app.db"))

# ---------- 엣지 기기 인증 ----------
# 영상 모듈/센서가 숫자를 보낼 때 헤더 `X-Device-Key` 에 이 값을 넣어야 합니다.
# 프로토타입이라 단일 키를 쓰지만, 실제 배포 시엔 기기별 키를 edge_devices 테이블에 해시로 저장해야 합니다.
EDGE_API_KEY = os.getenv("EDGE_API_KEY", "dev-edge-key")

# ---------- 비전(학식/셔틀) 관련 (REQ-VIS-*) ----------
# 엣지 신호가 이 시간(초) 이상 끊기면 "대체값(제보·예측)" 으로 전환합니다. (REQ-VIS-03)
VISION_STALE_SECONDS = int(os.getenv("VISION_STALE_SECONDS", "60"))
# 검출 신뢰도가 이 값 미만이면 대체값으로 전환합니다. (REQ-VIS-03)
VISION_MIN_CONFIDENCE = float(os.getenv("VISION_MIN_CONFIDENCE", "0.35"))
# 통과선을 못 볼 때 쓰는 시간대별 처리율 상수(명/분). 3주차 현장 관찰값으로 바꿉니다. (REQ-VIS-05)
# 키는 "HH" 시각. 없는 시각은 DEFAULT_THROUGHPUT 을 씁니다.
FALLBACK_THROUGHPUT_BY_HOUR = {
    "11": 6.0, "12": 8.0, "13": 7.0, "17": 5.0, "18": 6.0,
}
DEFAULT_THROUGHPUT_PER_MIN = 5.0
# 혼잡 3단계 경계(예상 대기 분). 사용자에겐 "여유/보통/혼잡" 으로만 보여줍니다.
LEVEL_RELAXED_MAX_MIN = 5.0     # 5분 이하 → 여유
LEVEL_NORMAL_MAX_MIN = 12.0     # 12분 이하 → 보통, 초과 → 혼잡

# ---------- 세탁(REQ-LAU-*) 관련 ----------
# 진동 세기(가속도 크기에서 중력 1g 를 뺀 절댓값, 단위 g)가 이 값을 넘으면 "진동 있음" 으로 봅니다.
VIB_THRESHOLD = float(os.getenv("VIB_THRESHOLD", "0.15"))
# 진동이 이 시간(초) 이상 연속되면 "사용 중" 으로 전환합니다. (REQ-LAU-01: 30초)
VIB_START_SECONDS = int(os.getenv("VIB_START_SECONDS", "30"))
# 무진동이 이 시간(분) 이상 연속되면 "사용 가능" 으로 전환합니다. (REQ-LAU-02: T 초깃값 5분)
# 세탁기는 불림·급수·배수 구간에서 진동이 거의 없으므로, 끊기자마자 종료로 보면 오판합니다.
VIB_END_MINUTES = float(os.getenv("VIB_END_MINUTES", "5"))
# 기본 코스 소요 시간(분). 화면의 "예상 종료" 기본값일 뿐, 종료 판정은 센서가 우선합니다. (REQ-LAU-01/03)
DEFAULT_CYCLE_MINUTES = int(os.getenv("DEFAULT_CYCLE_MINUTES", "50"))
# 센서 신호가 이 시간(분) 이상 없으면 "상태 불명" 으로 표시하고 호출 대상에서 뺍니다. (REQ-LAU-07)
SENSOR_STALE_MINUTES = int(os.getenv("SENSOR_STALE_MINUTES", "30"))
# 호출된 대기자가 이 시간(분) 안에 사용을 시작하지 않으면 순번을 만료합니다. (REQ-LAU-05)
QUEUE_CALL_TIMEOUT_MINUTES = int(os.getenv("QUEUE_CALL_TIMEOUT_MINUTES", "5"))

# ---------- 제보(REQ-RPT-*) ----------
# 같은 기기가 같은 자원에 다시 제보할 수 있기까지의 간격(분). (REQ-RPT-01: 10분)
REPORT_COOLDOWN_MINUTES = int(os.getenv("REPORT_COOLDOWN_MINUTES", "10"))
# 제보는 이 시간(분)이 지나면 화면에서 사라집니다. (오래된 제보가 현재 상태처럼 보이지 않게)
REPORT_TTL_MINUTES = int(os.getenv("REPORT_TTL_MINUTES", "30"))

# ---------- 셔틀(REQ-SHT-*, Should) ----------
SHUTTLE_BUS_CAPACITY = int(os.getenv("SHUTTLE_BUS_CAPACITY", "45"))

# ---------- 관리자 ----------
# /api/admin/* 와 관리 화면은 이 PIN 을 헤더 X-Admin-Pin 으로 보내야 합니다. 프로토타입용 단순 인증이며 배포 시 로그인으로 교체.
ADMIN_PIN = os.getenv("ADMIN_PIN", "0000")

# ---------- Web Push (VAPID) ----------
VAPID_KEY_PATH = DATA_DIR / "vapid.pem"                       # 서버 첫 실행 시 자동 생성
VAPID_CLAIMS_SUB = os.getenv("VAPID_CLAIMS_SUB", "mailto:team09@example.com")

# ---------- 오픈스페이스 QR 체크인 ----------
# 체크아웃을 안 찍고 나간 사람은 이 시간(분) 뒤 자동 퇴실 처리합니다.
CHECKIN_AUTO_EXPIRE_MINUTES = int(os.getenv("CHECKIN_AUTO_EXPIRE_MINUTES", "240"))

# ---------- 데모 모드 ----------
# 1 이면 실측·제보·관리자 입력이 전혀 없는 자원에 시연용 가상 값을 채웁니다 (logic/demo.py, source="demo" 로 표시).
# 실측이 들어오면 실측이 우선. 실사용 배포에서는 0 으로 두세요.
DEMO_MODE = os.getenv("DEMO_MODE", "1") == "1"

# ---------- 배포 ----------
# 배포 시 웹앱 주소만 허용: ALLOWED_ORIGINS="https://erica-wait.vercel.app,https://..." (비우면 전체 허용 = 개발용)
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()] or ["*"]
# 계정 토큰 서명용 비밀값. 배포 시 반드시 바꾸세요.
AUTH_SECRET = os.getenv("AUTH_SECRET", "dev-auth-secret-change-me")

# ---------- 시연 배속 ----------
# DEMO_TIME_SCALE=20 으로 서버를 띄우면 위의 "초/분" 상수가 전부 1/20 이 됩니다 (30초→1.5초, 5분→15초, 50분→2.5분).
# sensors/simulate_washer.py --speed 20 --no-virtual-ts 와 함께 쓰면, 실제 시계 기준으로 상태 전이와 남은 시간이 맞게 보입니다.
# 실측·테스트에서는 반드시 1(기본) 이어야 합니다. 테스트는 이 값을 건드리지 않습니다.
DEMO_TIME_SCALE = float(os.getenv("DEMO_TIME_SCALE", "1"))
if DEMO_TIME_SCALE != 1:
    VISION_STALE_SECONDS = max(5, int(VISION_STALE_SECONDS / DEMO_TIME_SCALE))
    VIB_START_SECONDS = max(1, int(VIB_START_SECONDS / DEMO_TIME_SCALE))
    VIB_END_MINUTES = VIB_END_MINUTES / DEMO_TIME_SCALE
    DEFAULT_CYCLE_MINUTES = max(1, round(DEFAULT_CYCLE_MINUTES / DEMO_TIME_SCALE))
    SENSOR_STALE_MINUTES = max(1, round(SENSOR_STALE_MINUTES / DEMO_TIME_SCALE))
    QUEUE_CALL_TIMEOUT_MINUTES = max(1, round(QUEUE_CALL_TIMEOUT_MINUTES / DEMO_TIME_SCALE))
