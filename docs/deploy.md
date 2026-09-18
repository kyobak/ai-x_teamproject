# 배포 가이드

## 현재 배포 주소 (2026-09-19)
| 구성 | 주소 | 비고 |
|---|---|---|
| 웹앱 (Vercel) | **https://erica-wait.vercel.app** | 휴대폰·PC 모두 이 주소. 홈 화면에 추가 가능 |
| 백엔드 (Render 무료) | https://erica-wait-api.onrender.com | `/api/health`, `/docs`. 15분 무요청 시 잠듦 → 첫 요청 30~60초 |
| 관리자 PIN · 기기 키 | Render 대시보드 → erica-wait-api → Environment | `ADMIN_PIN`, `EDGE_API_KEY` 자동 생성값 |

- 백엔드는 `main` 푸시마다 자동 재배포됩니다.
- 웹앱은 CLI 로 올렸으므로 코드 수정 후 `cd apps/web && npx vercel deploy --prod --yes` 를 실행해야 반영됩니다. (Vercel 대시보드 → Settings → Git 에서 저장소를 연결하면 이후 자동 배포, Root Directory 는 `apps/web`)
- 노트북 영상을 배포 서버로 보내기: `.venv/bin/python vision/run_video.py --api https://erica-wait-api.onrender.com --device-key <EDGE_API_KEY> --loop --show`

구성: **웹앱 → Vercel**, **백엔드 → Render 무료 플랜(시연용) 또는 Fly.io(볼륨 있음, 카드 필요)**, 영상·센서는 카메라/센서가 있는 기기(노트북·Pi)에서 실행해 배포된 백엔드로 숫자만 보냅니다.
HTTPS 가 되면 휴대폰에서 Web Push 와 동작 센서(iPhone)가 동작합니다.

```
[노트북/Pi] run_video.py, ESP32 ──숫자만──▶ [Fly.io] FastAPI + SQLite(볼륨) ◀──SSE/API── [Vercel] Next.js PWA ◀── 휴대폰
```

## 0. 준비
- GitHub 저장소가 최신 커밋 상태
- 계정: Vercel(GitHub 로그인), Fly.io(신용카드 등록 필요하지만 소규모 무료), 또는 Render
- CLI: `brew install flyctl` / `npm i -g vercel`

## 1-A. 백엔드 (Render 무료 플랜, 카드 불필요 — 시연용)
1. https://dashboard.render.com → **New → Blueprint** → GitHub 저장소 `kyobak/ai-x_teamproject` 연결 → `render.yaml` 감지 → **Apply**
2. 서비스 `erica-wait-api` 의 **Environment** 탭에서 자동 생성된 `EDGE_API_KEY`, `ADMIN_PIN` 값을 확인해 팀에 공유
3. 주소는 `https://erica-wait-api.onrender.com` (이름이 이미 쓰이면 뒤에 접미사가 붙음). `…/api/health` 로 확인
- 제약: 15분 무요청 시 잠듦(첫 요청 30~60초). 시연 5분 전에 한 번 열어 깨우세요. 디스크가 없어 재배포 때 DB 가 초기화됩니다(시드가 다시 채움, 계정·대기열은 사라짐).
- `main` 에 푸시하면 자동 재배포.

## 1-B. 백엔드 (Fly.io — 볼륨으로 DB 유지, 결제수단 등록 필요)
```bash
fly auth login
fly launch --no-deploy --copy-config --name erica-wait-api --region nrt   # fly.toml 사용
fly volumes create data --region nrt --size 1                              # SQLite·VAPID 키 보관
fly secrets set EDGE_API_KEY=$(openssl rand -hex 16) ADMIN_PIN=1234 AUTH_SECRET=$(openssl rand -hex 32) \
                ALLOWED_ORIGINS=https://<웹앱 도메인>.vercel.app VAPID_CLAIMS_SUB=mailto:팀메일@hanyang.ac.kr
fly deploy
fly status && curl https://erica-wait-api.fly.dev/api/health
```
- `EDGE_API_KEY` 는 영상·센서 쪽 `--device-key` / 펌웨어 `DEVICE_KEY` 에 똑같이 넣습니다.
- DB 초기화가 필요하면 `fly ssh console` → `rm /app/server/data/app.db` 후 재시작.
- Render 를 쓰면 `render.yaml` 을 Blueprint 로 연결하고 환경변수만 채우면 됩니다.

## 2. 웹앱 (Vercel)
```bash
cd apps/web
vercel link                     # 프로젝트 생성/연결
vercel env add NEXT_PUBLIC_API_BASE production    # 값: https://erica-wait-api.fly.dev
vercel --prod
```
GitHub 연동을 켜면 `main` 푸시마다 자동 배포, PR 마다 미리보기 URL 이 생깁니다(계획서 협업 규칙).
Root Directory 는 `apps/web` 로 지정하세요.

## 3. 영상·센서 연결
```bash
# 노트북에서 배포 서버로 숫자 전송
.venv/bin/python vision/run_all.py --api https://erica-wait-api.fly.dev
.venv/bin/python vision/run_video.py --api https://erica-wait-api.fly.dev --device-key <EDGE_API_KEY> --loop --show
```
ESP32 펌웨어의 `API` 를 `https://erica-wait-api.fly.dev/api/sensors/vibration` 으로. (ESP32 HTTPS 는 `WiFiClientSecure` + `setInsecure()` 로 간단히 처리 가능)

## 4. 배포 후 점검
- [ ] `https://<웹앱>/` 에서 홈 히어로에 숫자가 뜨는지 (DEMO_MODE=1 이면 시뮬레이션 값)
- [ ] 휴대폰 홈 화면에 추가 → 알림 허용 → 관리 화면 "푸시 테스트" 가 도착하는지
- [ ] `/admin` PIN 이 기본값(0000)이 아닌지
- [ ] `ALLOWED_ORIGINS` 가 웹앱 도메인으로 제한돼 있는지
- [ ] `DEMO_MODE` 를 실사용 때 0 으로 바꿨는지

## 5. 로컬 Docker 로 배포와 같은 환경 확인
```bash
docker compose up --build      # api :8000, web :3000
```

## 비용 메모
Fly.io shared-cpu-1x 1대 + 1GB 볼륨: 월 2~3달러 수준(무료 크레딧 범위). Vercel Hobby: 무료. 도메인은 선택.
