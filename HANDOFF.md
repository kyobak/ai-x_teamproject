# 인수인계 (HANDOFF)

> 이 파일은 "다음 개발자(사람 또는 AI 에이전트)가 이 저장소를 처음 열었을 때 10분 안에 이어서 작업할 수 있게" 쓰였습니다.
> 작업을 이어받으면 맨 아래 **작업 일지**에 날짜·한 일·남은 일을 추가하세요.

## 0. 30초 요약
- 무엇: ERICA 캠퍼스 대기 통합 서비스 프로토타입 (계획서 3.1판의 Must 슬라이스 A·B + Should 셔틀 화면).
- 상태: **로컬에서 전부 동작**. 백엔드 20개 테스트 통과, 웹 lint/build 통과, 영상 파이프라인이 샘플 영상으로 숫자를 보내고 대시보드가 실시간 갱신됨. 세탁 슬라이스는 시뮬레이터로 검증.
- 실행법: `README.md` 1절. 아키텍처 결정 이유: `docs/adr/`.
- 계획서 원본: https://claude.ai/artifact/BtRxjwqu6PTJEaNwNi2J8H (팀 굳건 준비계획서 개정 3.1판)

## 1. 사용자(팀)의 요구 조건 — 반드시 지킬 것
1. 모바일·웹에서 동작하는 **프로토타입**. CCTV 연동 없이 **영상 파일**로 시연.
2. Figma UI/UX 는 개발과 병행이 어려우면 **개발 먼저** 완성.
3. **모든 코드에 "왜" 주석** 또는 README. 마지막 주 발표 때 팀원 4명이 코드를 전부 이해한 상태여야 함. → 새 코드를 추가하면 같은 수준의 한국어 주석을 달 것.
4. 사용량 한도에 대비해 이 인수인계 파일을 유지할 것.
5. 프로젝트 폴더(`ai-x_teamproject/`) 안에서만 작업.

## 2. 지금 어디까지 됐나 (2026-09-18 기준)

| 영역 | 파일 | 상태 | 비고 |
|---|---|---|---|
| 백엔드 API | `server/app/**` | ✅ | FastAPI + SQLite, SSE 실시간, `/docs` 자동 문서 |
| 순수 로직 | `server/app/logic/{wait_time,laundry,queue}.py` | ✅ | 계획서 EARS 그대로. 상수는 `config.py` |
| 테스트 | `tests/` | ✅ 20 passed | REQ ID 별 1개 이상 |
| 비전 파이프라인 | `vision/run_video.py` | ✅ | yolo11n + ByteTrack + supervision. 샘플 영상에서 구역 8~10명, 처리율 산출 확인 |
| 구역 도구 | `vision/zone_tool.py` | ✅ (수동 GUI) | 현장 영상마다 다시 그려야 함 |
| 정확도 평가 | `vision/eval/eval_counts.py` | ✅ 스크립트 | 실제 정답 CSV 는 아직 없음 (샘플만) |
| 세탁 센서 | `sensors/simulate_washer.py` | ✅ 시뮬레이터 | 실제 펌웨어 `sensors/firmware/*.ino` 는 **미검증 초안** |
| 웹앱 | `apps/web/src/**` | ✅ | Next.js 16 App Router, Tailwind v4, PWA manifest + sw.js |
| 셔틀 | `apps/web/src/app/shuttle/page.tsx` | ✅ 화면 | 데이터는 `shuttle-1` 자원에 vision metrics 를 보내면 됨 (`run_video.py --resource shuttle-1`) |
| 메뉴 크롤러 | `jobs/crawl_menu.py` | ⏳ 뼈대 | robots.txt 확인 후 URL·파서 채우기 |
| 예측 | `jobs/predict.py` | ✅ 과거 평균 | 데이터 쌓인 뒤 실행 |
| Figma | `docs/design.md` | ✅ 5화면 와이어프레임 + 색 토큰 | https://www.figma.com/design/DfNWMFeY7cNgnY3bB54BHu · 컴포넌트화는 미완 |
| 배포(Vercel 등) | — | ❌ | 로컬 시연이 목표라 미룸 |

## 3. 알아둬야 할 설계 결정 (자세한 건 docs/adr/)
- **Supabase 대신 SQLite**: 계정·네트워크 없이 노트북 한 대로 시연하기 위해. 스키마는 계획서 그대로라 Postgres 이전이 쉬움. (ADR-0001)
- **SSE(Server-Sent Events)**: 서버→화면 단방향이면 충분. `apps/web/src/lib/realtime.tsx` 가 앱 전체에서 연결 하나만 유지.
- **판정 규칙은 전부 서버에**: 센서 펌웨어는 진동 세기 숫자만 보냄. 임계값·T 를 바꿀 때 펌웨어 재업로드 불필요.
- **프레임 비저장**: `vision/run_video.py` 에 `imwrite`/`VideoWriter` 없음. API 는 `image` 같은 미정의 필드를 422 로 거부. `.gitignore` 가 영상 확장자 차단.
- **익명 기기 ID**: localStorage UUID. 학번·이름·GPS 는 어디에도 없음.

## 4. 남은 일 (우선순위 순)
1. **Figma 다듬기** — 5화면 프레임과 `Tokens` 변수 컬렉션은 있음(`docs/design.md`). 남은 것: Badge/Card/MachineCard/BottomNav 컴포넌트화, 변수 바인딩, 빈 상태·오류 상태 화면.
2. **실측값 반영** — 5주차 세탁기 로깅 후 `config.py` 의 `DEFAULT_CYCLE_MINUTES`, `VIB_END_MINUTES`, `VIB_THRESHOLD`. 3주차 관찰 후 `FALLBACK_THROUGHPUT_BY_HOUR`.
3. **연출 영상으로 구역 재설정** — `zone_tool.py` 로 `vision/zones/cafeteria-1.json` 다시 그리기. 줄 구역과 통과선이 한 시야에 들어오는지 확인(REQ-VIS-05).
4. **정확도 평가 데이터** — 공개 데이터셋(MOT17/CrowdHuman) 프레임 몇 장에 정답 인원을 적은 CSV 만들고 `eval_counts.py` 실행 → REQ-VIS-04 수치 확정.
5. **실제 센서** — ESP32 + MPU6050 으로 `sensors/firmware/esp32_mpu6050.ino` 검증. 서버 `X-Device-Key` 는 `server/.env` 의 `EDGE_API_KEY`.
6. **메뉴 크롤러** — robots.txt 확인 후 `jobs/crawl_menu.py` 채우기.
7. **배포** — 필요하면 백엔드는 Fly.io/Render, 웹은 Vercel. `NEXT_PUBLIC_API_BASE` 설정. CORS 출처 제한.
8. **관리자 화면 인증** — 지금은 누구나 `/admin` 가능. 배포 전 필수.
9. **Web Push(VAPID)** — 현재는 SSE + Notification API. 앱을 닫아도 알림을 받으려면 Web Push 필요(`push_subs` 테이블은 계획서에 있으나 미구현).

## 5. 자주 쓰는 명령
```bash
.venv/bin/python -m pytest tests -q                              # 테스트
.venv/bin/python -m uvicorn app.main:app --app-dir server --reload --host 0.0.0.0 --port 8000
npm run dev --prefix apps/web                                    # 웹
.venv/bin/python vision/run_video.py --loop --show               # 영상 데모
.venv/bin/python vision/run_video.py --dry-run                   # 서버 없이 숫자만 출력
.venv/bin/python sensors/simulate_washer.py --resource laundry-w1 --speed 20
.venv/bin/python vision/simulate_metrics.py --resource cafeteria-1   # YOLO 없이 화면 시연
curl -s localhost:8000/api/resources | python3 -m json.tool      # 현재 상태 확인
```

## 6. 알려진 제약·함정
- `--speed` 배속 시뮬레이터는 가상 시각을 보내므로 "남은 분" 이 실제 시계와 어긋남 (README 5절).
- `/api/queue/me` 는 `/api/queue/{resource_id}` 보다 **먼저** 등록돼야 함 (라우트 순서 버그를 한 번 겪음, 회귀 테스트 있음).
- supervision 0.30 의 `ByteTrack` 은 FutureWarning(0.31 에서 제거 예정). `vision/requirements.txt` 로 `<0.31` 고정.
- React 19 + Next 16 의 lint 는 effect 안 setState 를 엄격히 막음. `realtime.tsx` 의 eslint-disable 주석 참고.
- Python 3.14 + torch 2.14 조합에서 개발. 3.11~3.13 도 될 것으로 보이나 미확인.
- 관리자 입력은 30분만 유효 (`services._latest_admin`).

## 7. 작업 일지
- **2026-09-18 (Claude, 1차)**: 저장소 구조 확정, 백엔드·로직·테스트, 비전 파이프라인, 세탁 시뮬레이터, 웹앱 5개 화면, PWA, README/ETHICS/PROMPTS/ADR/specs 작성. 로컬 E2E 확인(휴대폰 뷰포트 스크린샷, 대기열 호출 배너). Figma 5화면 와이어프레임 + 색 토큰 생성(Figma MCP 사용). 배속 시연용 `DEMO_TIME_SCALE` 추가.
