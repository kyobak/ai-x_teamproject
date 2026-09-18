"""
영상 파일 → 사람 검출 → 줄 구역 인원 + 통과선 처리율 → 숫자만 서버로 전송.

계획서 "처리 파이프라인" 6단계를 그대로 코드로 옮겼습니다:
  1. 프레임 입력      : 영상 파일(데모) 또는 웹캠(--source 0). 디스크에 쓰지 않습니다.
  2. 사람 검출        : YOLO nano (yolo11n.pt), 클래스 0(person) 만 남김
  3. 대기 구역 판정   : 다각형(queue_polygon) 안에 "발 위치(BOTTOM_CENTER)" 가 있는 사람만 셈, 10초 이동 중앙값으로 평활화
  4. 처리율 측정      : ByteTrack 으로 사람에 ID 를 붙이고, 통과선(pass_line) 을 넘는 ID 수를 최근 60초 창으로 세어 분당 처리 인원
  5. 대기시간 계산    : 인원 ÷ 처리율 (서버도 같은 계산을 하므로 여기선 참고용으로만 출력)
  6. 숫자만 전송      : resource_id, people_count, throughput_per_min, confidence 만 POST. 프레임·박스 좌표는 전송/저장하지 않음 (REQ-VIS-01)

실행 예:
  .venv/bin/python vision/run_video.py --source vision/samples/people-walking.mp4 --zone vision/zones/cafeteria-1.json --loop --show
  .venv/bin/python vision/run_video.py --source 0 --resource cafeteria-1 --zone vision/zones/cafeteria-1.json   # 웹캠

--show 는 화면에 박스/구역을 그려 보여주기만 하고(데모용) 어디에도 저장하지 않습니다.
이 파일에는 cv2.imwrite / VideoWriter 가 없어야 합니다. PR 체크리스트 항목입니다.
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from collections import deque
from pathlib import Path

import warnings

import cv2
import numpy as np
import requests
import supervision as sv
from ultralytics import YOLO

# supervision 0.28+ 은 ByteTrack 을 별도 패키지(trackers)로 옮길 예정이라 FutureWarning 을 냅니다.
# 0.30 에서는 여전히 동작하므로 버전을 고정(requirements)하고 경고만 숨깁니다. 나중에 옮길 때 이 줄을 지우세요.
warnings.filterwarnings("ignore", category=FutureWarning)

PERSON_CLASS_ID = 0   # COCO 데이터셋에서 0 = person


def load_zone(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


class ThroughputCounter:
    """통과선을 넘은 시각들을 기억해 두고 '최근 window 초 동안 몇 명' → 분당 처리 인원으로 환산합니다.
    LineZone 의 누적 카운트(in_count)만 쓰면 영상 시작부터의 총합이 되어 '지금' 처리율을 못 나타내기 때문입니다."""

    def __init__(self, window_sec: float = 60.0, t0: float = 0.0):
        self.window = window_sec
        self.t0 = t0                      # 계수를 시작한 시각. 초반 과대평가 방지용
        self.times: deque[float] = deque()

    def add(self, t: float, n: int) -> None:
        for _ in range(n):
            self.times.append(t)

    def per_minute(self, now: float) -> float:
        while self.times and now - self.times[0] > self.window:
            self.times.popleft()
        if not self.times:
            return 0.0
        # 영상 초반엔 60초 창이 다 차지 않았으므로 "계수 시작 후 경과 시간" 으로 나눕니다.
        # 다만 최소 15초는 지난 것으로 간주해, 첫 통과 1명이 "분당 60명" 처럼 튀는 것을 막습니다.
        elapsed = min(self.window, max(now - self.t0, 15.0))
        return round(len(self.times) / elapsed * 60.0, 2)


def main() -> None:
    ap = argparse.ArgumentParser(description="영상 기반 줄 인원·처리율 계수 (숫자만 전송)")
    ap.add_argument("--source", default=None,
                    help="영상 파일 경로 또는 웹캠 번호(0). 생략하면 vision/samples/demo.mp4(우리 촬영본) → people-walking.mp4(공개 샘플) 순으로 찾음")
    ap.add_argument("--zone", default="vision/zones/cafeteria-1.json")
    ap.add_argument("--resource", default="cafeteria-1", help="서버의 resource id")
    ap.add_argument("--api", default="http://localhost:8000")
    ap.add_argument("--device-key", default="dev-edge-key")
    ap.add_argument("--device-id", default="edge-laptop")
    ap.add_argument("--model", default="yolo11n.pt", help="Ultralytics 가중치 (없으면 자동 다운로드)")
    ap.add_argument("--conf", type=float, default=0.3, help="검출 신뢰도 하한")
    ap.add_argument("--interval", type=float, default=2.0, help="서버 전송 간격(초). 계획서: 2~5초")
    ap.add_argument("--smooth-sec", type=float, default=10.0, help="인원 이동 중앙값 창(초)")
    ap.add_argument("--stride", type=int, default=2, help="n 프레임마다 1번 추론 (속도용)")
    ap.add_argument("--loop", action="store_true", help="영상 파일이 끝나면 처음부터 반복 (데모용)")
    ap.add_argument("--realtime", action="store_true", default=True, help="영상 fps 에 맞춰 재생 속도 제한")
    ap.add_argument("--show", action="store_true", help="주석 달린 화면 표시 (저장 안 함)")
    ap.add_argument("--dry-run", action="store_true", help="서버로 보내지 않고 콘솔에만 출력")
    args = ap.parse_args()
    if args.source is None:
        # 팀이 촬영한 연출 영상은 vision/samples/demo.mp4 에 두는 것이 약속입니다 (README "우리 영상으로 바꾸기").
        for cand in ("vision/samples/demo.mp4", "vision/samples/people-walking.mp4"):
            if Path(cand).exists():
                args.source = cand
                break
        else:
            sys.exit("영상이 없습니다. vision/samples/demo.mp4 를 넣거나 vision/download_sample.py 를 실행하세요.")

    zone_cfg = load_zone(Path(args.zone))
    polygon = np.array(zone_cfg["queue_polygon"], dtype=np.int64)
    line = zone_cfg["pass_line"]
    has_line = line is not None   # 통과선을 못 보는 현장(REQ-VIS-05)이면 zone 파일에서 null 로 둡니다.

    model = YOLO(args.model)
    tracker = sv.ByteTrack()
    queue_zone = sv.PolygonZone(polygon=polygon, triggering_anchors=(sv.Position.BOTTOM_CENTER,))
    line_zone = (
        sv.LineZone(start=sv.Point(*line["start"]), end=sv.Point(*line["end"]),
                    triggering_anchors=(sv.Position.BOTTOM_CENTER,))
        if has_line else None
    )
    throughput = ThroughputCounter(window_sec=60.0, t0=0.0)

    # --show 용 주석 도구. 결과를 화면에 그리기만 합니다.
    box_annot = sv.BoxAnnotator(thickness=2)
    zone_annot = sv.PolygonZoneAnnotator(zone=queue_zone, color=sv.Color.GREEN, thickness=3)
    line_annot = sv.LineZoneAnnotator(thickness=3, text_scale=1.0) if has_line else None

    src = int(args.source) if str(args.source).isdigit() else args.source
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        sys.exit(f"영상을 열 수 없습니다: {args.source}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    is_file = not isinstance(src, int)

    counts_window: deque[tuple[float, int]] = deque()   # (시각, 구역 인원)
    conf_window: deque[float] = deque(maxlen=50)
    last_sent = 0.0
    frame_idx = 0
    video_t = 0.0        # 영상 내 시각(초). 파일 재생은 이 시계를, 웹캠은 실제 시계를 씁니다.
    wall_start = time.time()
    session = requests.Session()

    print(f"[vision] source={args.source} model={args.model} resource={args.resource} api={args.api}")
    while True:
        ok, frame = cap.read()
        if not ok:
            if is_file and args.loop:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                # 반복 재생 시 추적 ID 가 이어지지 않도록 트래커를 새로 만듭니다.
                tracker = sv.ByteTrack()
                throughput = ThroughputCounter(window_sec=60.0, t0=0.0)
                frame_idx = 0
                wall_start = time.time()
                continue
            break
        frame_idx += 1
        video_t = frame_idx / fps if is_file else time.time() - wall_start
        if frame_idx % args.stride:
            continue

        # 2. 사람 검출 (사람 클래스만, 지정 신뢰도 이상)
        result = model(frame, classes=[PERSON_CLASS_ID], conf=args.conf, verbose=False)[0]
        det = sv.Detections.from_ultralytics(result)
        # 4. 추적 (통과선 계수엔 같은 사람을 두 번 세지 않기 위한 ID 가 필요)
        det = tracker.update_with_detections(det)

        # 3. 줄 구역 안의 사람 수
        in_zone = queue_zone.trigger(det)
        zone_count = int(in_zone.sum())
        counts_window.append((video_t, zone_count))
        while counts_window and video_t - counts_window[0][0] > args.smooth_sec:
            counts_window.popleft()
        smoothed = int(statistics.median(c for _, c in counts_window))
        if len(det.confidence) > 0:
            conf_window.extend(det.confidence.tolist())

        # 4. 통과선 처리율
        if line_zone is not None:
            crossed_in, crossed_out = line_zone.trigger(det)
            n_cross = int(crossed_in.sum() + crossed_out.sum()) if zone_cfg.get("line_count_direction", "both") == "both" else int(crossed_in.sum())
            throughput.add(video_t, n_cross)
        thr = throughput.per_minute(video_t) if line_zone is not None else None

        # 5. 대기시간 (참고 출력; 서버가 다시 계산)
        est = round(smoothed / thr, 1) if thr else None
        confidence = round(float(np.mean(conf_window)), 3) if conf_window else 0.0

        # 6. 숫자만 전송 (interval 초마다)
        if time.time() - last_sent >= args.interval:
            last_sent = time.time()
            payload = {"resource_id": args.resource, "people_count": smoothed,
                       "throughput_per_min": thr, "confidence": confidence, "device_id": args.device_id}
            print(f"t={video_t:6.1f}s zone={zone_count:2d} smoothed={smoothed:2d} thr/min={thr} est_wait={est} conf={confidence}")
            if not args.dry_run:
                try:
                    session.post(f"{args.api}/api/vision/metrics", json=payload,
                                 headers={"X-Device-Key": args.device_key}, timeout=3)
                except requests.RequestException as e:
                    print("  [send failed]", e)

        if args.show:
            vis = box_annot.annotate(frame.copy(), det)
            vis = zone_annot.annotate(vis)
            if line_annot:
                vis = line_annot.annotate(vis, line_zone)
            cv2.putText(vis, f"queue={smoothed}  thr/min={thr}  wait={est}min", (30, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.4, (0, 255, 255), 3)
            cv2.imshow("queue counter (not recorded)", vis)
            # 종료 키는 ESC 만. 예전엔 'q' 였는데, 영상 창이 포커스를 가진 채로 한글을 타이핑하면
            # ㅂ(=q 키) 이 들어와 프로그램이 조용히 꺼지는 사고가 실제로 있었습니다.
            if cv2.waitKey(1) & 0xFF == 27:
                print("[vision] ESC 입력으로 종료")
                break

        # 파일 재생을 실제 시간에 맞춰 늦춥니다(안 그러면 14초 영상이 3초 만에 끝나 데모가 안 됩니다).
        if is_file and args.realtime:
            target = wall_start + video_t
            delay = target - time.time()
            if delay > 0:
                time.sleep(delay)

    cap.release()
    if args.show:
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
