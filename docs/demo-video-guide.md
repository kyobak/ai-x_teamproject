# 시연 영상 촬영·적용 가이드 (YOLO 에 넣을 파일 위치)

## 파일 위치 (약속)
```
vision/samples/demo.mp4        ← 우리가 찍은 연출 영상. 이 이름으로 두면 run_video.py 가 자동으로 집습니다
vision/zones/cafeteria-1.json  ← 그 영상 기준으로 그린 줄 구역(초록 다각형)과 통과선(빨간 선)
```
`vision/samples/` 는 `.gitignore` 로 커밋되지 않습니다(영상은 저장소에 올리지 않음, ETHICS.md). 팀원끼리는 드라이브로 공유하세요.
`demo.mp4` 가 없으면 공개 샘플 `people-walking.mp4` 를 씁니다.

## 촬영 요령 (5주차·6주차)
1. **카메라 높이**: 눈높이보다 위(2m+)에서 내려다보게. 가림이 줄고 얼굴 식별 가능성도 낮아집니다.
2. **한 화면에 두 가지**: 줄이 서는 구역 + 배식구(통과선)를 같은 프레임에. 둘이 한 시야에 안 들어오면 처리율은 상수로 대체됩니다(REQ-VIS-05).
3. **길이**: 3~5분. 줄이 늘었다 줄었다 하는 변화가 있어야 그래프가 살아납니다.
4. **참여자**: 동의서 쓴 팀원·지인만. 촬영 구역을 바닥 테이프로 표시.
5. **해상도**: 1080p 30fps 면 충분. 4K 는 느려집니다. 세로 영상은 피하세요.

## 적용 순서
```bash
# 1) 파일 복사
cp ~/Downloads/우리영상.mp4 vision/samples/demo.mp4

# 2) 구역 그리기: 왼쪽 클릭으로 줄 구역 꼭짓점 4개 이상 → l 키 → 통과선 두 점 클릭 → s 저장 → q
.venv/bin/python vision/zone_tool.py --source vision/samples/demo.mp4 --out vision/zones/cafeteria-1.json

# 3) 서버 없이 숫자만 확인
.venv/bin/python vision/run_video.py --dry-run --show

# 4) 실제 시연 (백엔드 켜고)
.venv/bin/python vision/run_video.py --loop --show
```
셔틀 영상은 `--source vision/samples/shuttle.mp4 --zone vision/zones/shuttle-1.json --resource shuttle-1` 로 따로 돌립니다.

## 정확도 측정 (REQ-VIS-04)
영상에서 25프레임마다 사람이 직접 센 정답을 `vision/eval/our_eval.csv` 에 적고:
```bash
.venv/bin/python vision/eval/eval_counts.py --csv vision/eval/our_eval.csv
.venv/bin/python vision/eval/compare_models.py --source vision/samples/demo.mp4   # n/s 모델 비교
```
