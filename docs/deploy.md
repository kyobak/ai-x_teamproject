# 배포 가이드

구성: **웹앱 → Vercel**, **백엔드 → Fly.io(또는 Render)**, 영상·센서는 카메라/센서가 있는 기기(노트북·Pi)에서 실행해 배포된 백엔드로 숫자만 보냅니다.
HTTPS 가 되면 휴대폰에서 Web Push 와 동작 센서(iPhone)가 동작합니다.

```
[노트북/Pi] run_video.py, ESP32 ──숫자만──▶ [Fly.io] FastAPI + SQLite(볼륨) ◀──SSE/API── [Vercel] Next.js PWA ◀── 휴대폰
```

## 0. 준비
- GitHub 저장소가 최신 커밋 상태
- 계정: Vercel(GitHub 로그인), Fly.io(신용카드 등록 필요하지만 소규모 무료), 또는 Render
- CLI: `brew install flyctl` / `npm i -g vercel`

## 1. 백엔드 (Fly.io)
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
