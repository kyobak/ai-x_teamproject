# ERICA 캠퍼스 대기 통합 서비스 — 프로토타입

> AI+X 공학융합프로젝트 2026 가을 · 팀 굳건 (team09)
> 학식·세탁실·셔틀처럼 줄이 생기는 곳을 한 앱에서 보고, **영상으로 줄 인원과 처리율을 세어 "지금 서면 몇 분"** 을 알려주는 프로토타입입니다.

이 저장소는 계획서(개정 3.1판)의 Must 범위인 **수직 슬라이스 2개**를 끝까지 구현한 상태입니다.

| 슬라이스 | 내용 | 상태 |
|---|---|---|
| A. 학식 | 영상 파일 → YOLO 사람 검출 → 줄 구역 인원 + 통과선 처리율 → 예상 대기시간 → 대시보드 | ✅ 동작 |
| B. 세탁실 | 진동 센서 값 → 사용 중/사용 가능 판정(30초 시작, 무진동 5분 종료) → 가상 대기열 → 내 차례 알림 | ✅ 동작 (센서는 시뮬레이터) |
| Should. 셔틀 | 같은 비전 수치 + 시간표 + 정원 → "몇 대 뒤 탑승" | ✅ 화면·계산 구현 (데이터는 학식 모듈 재사용) |
| Could. 오픈스페이스 | 입구 QR 체크인/체크아웃 → 재실 인원 (`/checkin/space-1`, 관리 화면에서 QR 출력) | ✅ 동작 |
| Could. 주차장 | 관리자 수동 입력 목업 | ✅ 목업 |
| Could. 관리자 자원 등록 | PIN 로그인 후 자원 추가·삭제 (`/admin`) | ✅ 동작 |
| Could. 영어 UI | 헤더의 EN/한 토글 (고정 문구만 번역) | ✅ 동작 |
| Should. Web Push | 앱을 닫아도 "내 차례" 알림 (VAPID, `server/app/push.py`) | ✅ 동작 (HTTPS 또는 localhost 에서만 구독 가능) |
| 메뉴 | 복지포털 공개 데이터에서 식당 4곳 조·중·석식 (`jobs/crawl_menu.py`) | ✅ 동작 |
| 센서 대안 | 휴대폰 가속도계를 센서로 (`/sensor`) | ✅ 동작 |

CCTV 연동은 하지 않습니다. **영상 파일(또는 웹캠)을 노트북에서 재생하며 숫자만 서버로 보내는** 방식으로 시연합니다.

---

## 1. 5분 만에 실행하기

준비물: Python 3.11+ (3.14 에서 개발), Node 20+ (24 에서 개발). macOS/Windows/Linux 모두 가능.

```bash
# 0) 저장소 루트에서
python3 -m venv .venv
.venv/bin/pip install -r server/requirements.txt -r vision/requirements.txt   # torch 포함 ~1GB, 5분 정도
cd apps/web && npm install && cd ../..

# ※ 아래 명령은 전부 "저장소 루트(ai-x_teamproject/)" 에서 실행합니다. 터미널을 새로 열 때마다 루트로 돌아오세요.
# ※ 시연에는 프로세스 4개가 "동시에" 떠 있어야 합니다: 백엔드, 웹앱, 영상 파이프라인, 세탁 시뮬레이터.
#    웹앱만 켜면 화면에 "서버에 연결할 수 없습니다" 또는 "데이터 없음" 만 보입니다.

# 1) 백엔드 (터미널 1)
.venv/bin/python -m uvicorn app.main:app --app-dir server --reload --host 0.0.0.0 --port 8000
#    → http://localhost:8000/docs 에서 API 문서 확인

# 2) 웹앱 (터미널 2)
npm run dev --prefix apps/web
#    → http://localhost:3000  (휴대폰: 같은 와이파이에서 http://<노트북IP>:3000)

# 3) 데모 데이터 공급 (터미널 3, 4)
.venv/bin/python vision/download_sample.py                       # 샘플 영상 1개 다운로드 (최초 1회)
.venv/bin/python vision/run_video.py --loop --show               # 영상 → 숫자 전송 (창에 박스 표시, 저장 안 함). 창에서 ESC 를 누르면 종료
.venv/bin/python sensors/simulate_washer.py --resource laundry-w1 --speed 20   # 세탁기 1 진동 시뮬레이션
```

> `no such file or directory: .venv/bin/python` 이 뜨면 현재 폴더가 루트가 아닌 것입니다. `cd` 로 루트로 돌아가세요.

Windows 는 `.venv/bin/python` 대신 `.venv\Scripts\python` 을 씁니다.

YOLO 가 안 깔리는 환경이면 `vision/simulate_metrics.py` 로 가짜 수치를 보내 화면만 시연할 수 있습니다.

### 휴대폰에서 보기
1. 노트북과 휴대폰을 같은 와이파이에 연결
2. 노트북 IP 확인 (`ipconfig getifaddr en0` / `ipconfig`)
3. 휴대폰 브라우저에서 `http://<IP>:3000` 접속. 웹앱이 자동으로 `http://<IP>:8000` 을 API 로 씁니다.
4. iOS 는 Safari "홈 화면에 추가" 후에 알림이 동작합니다. 알림이 막혀도 화면 상단 배너로 대체됩니다.

### 테스트
```bash
.venv/bin/python -m pytest tests -q        # 요구사항 ID 별 인수 테스트 (REQ-VIS, REQ-LAU, REQ-RPT, REQ-SYS)
cd apps/web && npm run lint && npm run build
```

---

### 관리자 화면
`/admin` 은 PIN(기본 `0000`, `server/.env` 의 `ADMIN_PIN`)을 넣어야 열립니다. 세탁기 상태 수동 입력, 혼잡도 입력, 자원 등록·삭제, 오픈스페이스 QR 출력, 푸시 테스트가 있습니다.

### 식단·매장 정보 갱신
```bash
.venv/bin/python jobs/crawl_menu.py      # 복지포털(life.hanyang.ac.kr) 공개 데이터 → jobs/data/campus_food.json + DB
```
식단 페이지 본문은 로그인이 필요해서, 페이지가 불러오는 공개 데이터 파일(`/theme/assets/js/mock-data.js`)을 읽습니다. 식당은 학생식당·창의관식당·교직원식당·창업보육센터식당 4곳. **푸드코트 입점 매장 목록은 로그인 뒤 시설안내에서만 보여** `jobs/data/campus_food.json` 의 `foodcourt_vendors_todo` 에 채워 넣으면 화면에 나옵니다(`server/app/db.py` 의 `foodcourt-1` extra.vendors).

### 우리 영상으로 시연하기
촬영한 영상을 **`vision/samples/demo.mp4`** 에 두면 `run_video.py` 가 자동으로 그 파일을 씁니다. 촬영 요령과 구역 그리기는 [docs/demo-video-guide.md](docs/demo-video-guide.md).

### 센서 구매·연동
[docs/sensor-guide.md](docs/sensor-guide.md): ESP32 + MPU-6050 (기기당 약 1.5만 원), 배선, 펌웨어, 실측으로 정할 값. 사기 전엔 `/sensor` 화면으로 휴대폰을 센서로 쓸 수 있습니다.

### 디자인
[docs/design/DESIGN-coinbase.md](docs/design/DESIGN-coinbase.md) 가이드를 따릅니다: 흰 캔버스, 파랑(#0052ff) 하나만 주요 버튼에, 24px 카드, 알약 버튼, 의미색은 글자에만. 제목·큰 숫자·버튼은 **잘난체 2(Jalnan2)**, 본문은 시스템 한글 서체. 폰트 파일은 `apps/web/public/fonts/` (원본 `assets/fonts/`)에 있어 팀원 모두 같은 글꼴로 봅니다. Figma 파일은 [docs/design.md](docs/design.md).

## 2. 폴더 구조

```
ai-x_teamproject/
├── server/              # FastAPI 백엔드 (SQLite). 상태 판정·대기열·대시보드 API
│   └── app/
│       ├── main.py          앱 진입점 + 주기 작업(신호 끊김·호출 만료)
│       ├── config.py        모든 상수 (50분, T=5분, 임계값 …) — 실측 후 여기만 수정
│       ├── db.py            스키마 + 시드 (계획서 데이터 모델 그대로)
│       ├── logic/           순수 계산: wait_time.py(인원÷처리율), laundry.py(진동 상태기계), queue.py
│       ├── services.py      logic 과 DB 를 잇는 조립 층
│       ├── routers/         URL 별 엔드포인트 (resources, vision, laundry, reports, admin, stream)
│       └── events.py        SSE 실시간 브로드캐스트
├── vision/              # 엣지 파이프라인. 프레임은 메모리에서만, 숫자만 전송
│   ├── run_video.py         영상/웹캠 → YOLO → 구역 인원 + 통과선 처리율 → POST
│   ├── zone_tool.py         줄 구역·통과선을 마우스로 그려 JSON 저장
│   ├── zones/               구역 설정 JSON
│   ├── simulate_metrics.py  YOLO 없이 가짜 수치 전송
│   └── eval/                정확도 평가(MAE, 3단계 분류 정확도) 스크립트 + 숫자 CSV
├── sensors/             # 세탁기 진동 센서
│   ├── simulate_washer.py   한 사이클 진동 프로파일 시뮬레이터
│   └── firmware/            ESP32 + MPU6050 펌웨어 초안 (미검증)
├── apps/web/            # Next.js PWA (모바일 우선)
│   └── src/
│       ├── app/             페이지: / (대시보드), /cafeteria/[id], /laundry, /shuttle, /admin
│       ├── components/      카드·배지·배너 등
│       └── lib/             api.ts, realtime.tsx(SSE 공급자), device.ts(익명 ID), format.ts
├── jobs/                # 크롤러(뼈대), 시간대별 예측(과거 평균)
├── tests/               # pytest 인수 테스트 (REQ ID 와 1:1)
├── specs/               # EARS 요구사항
├── docs/adr/            # 아키텍처 결정 기록
├── HANDOFF.md           # 다음 개발자 인수인계
├── PROMPTS.md           # 에이전트 사용 기록
└── ETHICS.md            # 윤리·법 노트
```

---

## 3. 동작 원리 (발표용 요약)

### 3.1 학식: 인원 수 ≠ 대기시간
```
예상 대기(분) = 줄 구역 인원 ÷ 분당 처리 인원
```
- **인원**: YOLO(yolo11n)로 사람 박스를 찾고, 발 위치(박스 아래 중앙)가 줄 다각형 안에 있는 사람만 셉니다. 가림으로 숫자가 튀므로 10초 이동 중앙값으로 평활화합니다.
- **처리율**: ByteTrack 으로 사람에 ID 를 붙이고, 배식구에 그은 통과선을 넘는 ID 수를 최근 60초 창으로 세어 분당으로 환산합니다.
- **폴백**: 통과선이 시야에 없으면(`zone.json` 의 `pass_line: null`) 시간대별 평균 처리율 상수를 쓰고 화면에 "추정" 이라고 표시합니다 (REQ-VIS-05). 카메라 신호가 60초 끊기거나 신뢰도가 낮으면 제보 → 예측값 순으로 대체하고 그 사실을 표시합니다 (REQ-VIS-03).
- 서버에는 `resource_id, people_count, throughput_per_min, confidence` 만 갑니다. `vision_metrics` 테이블엔 이미지가 들어갈 칸이 없고, API 는 정의되지 않은 필드(`image` 등)를 422 로 거부합니다 (REQ-VIS-01).

코드: `vision/run_video.py`, `server/app/logic/wait_time.py`

### 3.2 세탁실: 진동 센서 상태기계
```
available --(진동 > 임계값 30초 연속)--> in_use  [예상 종료 = 시작 + 50분]
in_use    --(무진동 T=5분 연속)--------> available [1순위 대기자 호출]
*         --(신호 30분 없음)-----------> unknown   [호출 대상 제외]
```
- 세탁기는 불림·배수 때 진동이 거의 없어서, 진동이 끊기자마자 종료로 보면 한 사이클에 종료를 여러 번 오판합니다. 그래서 **무진동 T분 연속**일 때만 종료입니다.
- 예상 종료 시각이 지나도 진동이 있으면 계속 "사용 중(동작 중)" 입니다. **타이머보다 센서가 우선**입니다 (REQ-LAU-03).
- 사이클이 끝날 때마다 실제 소요 시간을 기록해, 기기별 최근 평균으로 50분을 보정합니다 (Should).
- 대기열은 예약이 아니라 **가상 대기열**입니다. 기기가 비면 1순위에게 알리고, 5분 안에 시작하지 않으면 다음 순번으로 넘깁니다. 앱을 안 쓰는 학생이 먼저 써도 센서가 "사용 중" 으로 잡으므로 충돌하지 않습니다.

코드: `server/app/logic/laundry.py`, `server/app/logic/queue.py`, `server/app/services.py`

### 3.3 데이터 흐름
```
영상 파일/웹캠 ─ run_video.py ─┐
진동 센서/시뮬레이터 ──────────┤  숫자만 POST (X-Device-Key)
사용자 제보 (앱) ──────────────┤
관리자 입력 (앱) ──────────────┴─▶ FastAPI ─▶ SQLite
                                      │
                                      └─ SSE /api/stream ─▶ Next.js PWA (휴대폰·웹)
```

---

## 4. 실측 후 바꿔야 할 값 (`server/app/config.py`)

| 상수 | 현재 | 언제 확정 |
|---|---|---|
| `DEFAULT_CYCLE_MINUTES` | 50 | 5주차 세탁기 한 사이클 로깅 |
| `VIB_END_MINUTES` (T) | 5 | 5주차, 무진동 구간 최대 길이 |
| `VIB_THRESHOLD` | 0.15 g | 5주차, 옆 기기 진동 혼입 확인 |
| `FALLBACK_THROUGHPUT_BY_HOUR` | 예시값 | 3주차 현장 관찰(분당 처리 인원) |
| `LEVEL_*_MAX_MIN` (여유/보통/혼잡 경계) | 5 / 12분 | 설문 결과 |
| REQ-VIS-04 목표 MAE | 잠정 2명 | 스파이크 후 `vision/eval/eval_counts.py --target-mae` |

---

## 5. 시연 시나리오 (3분)

1. 휴대폰으로 대시보드를 열어 둔다.
2. 노트북에서 `run_video.py --loop --show` 실행 → 창에 초록 다각형(줄 구역)과 빨간 선(통과선)이 보이고, 휴대폰의 "학생식당" 카드가 2초마다 갱신된다. 상세 화면의 `8 ÷ 16 = 0.5` 계산식을 보여준다.
3. 영상을 끈다 → 60초 뒤 카드가 "시간대 예측 (카메라 신호 없음)" 으로 바뀐다. "제보" 버튼을 눌러 제보로 대체되는 것을 보여준다.
4. `simulate_washer.py --speed 20` 실행 → 세탁기 1 이 "사용 중, 약 50분 후 종료 예상" 이 된다. 휴대폰에서 "줄 서기".
5. 시뮬레이터가 탈수 후 무진동 5분(가상)을 지나면 "사용 가능" → 휴대폰에 "내 차례!" 배너/알림.

> **배속 시연 팁.** `--speed 20` 만 쓰면 시뮬레이터가 가상 시각을 보내 "남은 분" 이 실제 시계와 어긋납니다. 남은 시간까지 자연스럽게 보이려면 서버를 배속 모드로 띄우세요:
> ```bash
> DEMO_TIME_SCALE=20 .venv/bin/python -m uvicorn app.main:app --app-dir server --host 0.0.0.0 --port 8000
> .venv/bin/python sensors/simulate_washer.py --resource laundry-w1 --speed 20 --no-virtual-ts
> ```
> 이러면 30초→1.5초, 5분→15초, 50분→2.5분으로 모든 규칙이 같은 비율로 줄어 실제 시계와 맞습니다. 실측·테스트에서는 배속을 쓰지 마세요.
> 배속을 켜거나 끌 때는 기기별 학습 평균이 섞이지 않도록 `server/data/app.db` 를 지우고 다시 시작하세요.

---

## 6. 라이선스와 출처

| 구성 요소 | 라이선스 | 비고 |
|---|---|---|
| Ultralytics YOLO (yolo11n.pt) | **AGPL-3.0** | 가중치는 최초 실행 시 자동 다운로드. 상용 배포 시 라이선스 검토 필요 |
| Roboflow supervision | MIT | 구역·통과선 계수 |
| OpenCV, NumPy, PyTorch | Apache/BSD | |
| FastAPI, Uvicorn, Pydantic | MIT | |
| Next.js, React, Tailwind | MIT | |
| 샘플 영상 `people-walking.mp4` | Roboflow 공개 데모 자산 | 개발·시연 전용, 저장소에 포함하지 않음 |

이 저장소의 코드는 팀 굳건의 수업 과제물입니다.
