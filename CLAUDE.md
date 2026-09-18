# CLAUDE.md — 에이전트 컨텍스트

이 저장소에서 AI 코딩 에이전트가 지켜야 할 규칙입니다. 사람 팀원도 같은 규칙을 따릅니다.

## 절대 규칙
- `vision/` 안에 프레임을 파일로 쓰거나(`cv2.imwrite`, `VideoWriter`) 네트워크로 프레임/이미지를 보내는 코드를 **추가하지 않는다** (REQ-VIS-01).
- 학번·이름·GPS 좌표를 저장하는 컬럼·필드를 **추가하지 않는다** (REQ-SYS-01).
- 영상 파일(`*.mp4` 등)과 모델 가중치(`*.pt`)를 커밋하지 않는다.
- 새 코드에는 **"왜 이렇게 했는지"** 를 한국어 주석으로 남긴다. 발표 때 팀원이 설명할 수 있어야 한다.

## 작업 시작 시
1. `HANDOFF.md` 를 읽고 마지막 작업 일지를 확인한다.
2. 끝나면 `HANDOFF.md` 작업 일지와 `PROMPTS.md` 에 기록한다.

## 구조 요약
- 규칙(순수 함수): `server/app/logic/` — 테스트는 `tests/`
- 상수: `server/app/config.py` (실측 후 여기만 수정)
- 화면: `apps/web/src/app/` — 실시간은 `src/lib/realtime.tsx` 하나로
- 명령: `README.md` 1절, `HANDOFF.md` 5절

## 검증 명령
```bash
.venv/bin/python -m pytest tests -q
cd apps/web && npm run lint && npm run build
```
