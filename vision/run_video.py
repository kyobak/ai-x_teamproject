"""
영상 파일 → 사람 검출 → 구역별 인원 + 통과선 처리율 + 체류시간 → 숫자만 서버로 전송.

한 영상에서 여러 구역을 동시에 분석합니다 (zone 파일의 "zones" 배열). 구역 종류:
  - queue: 대기줄. 인원 + 통과선 처리율 + 평균 체류시간(줄 선 시간) → 학식·셔틀
  - room : 실내. 다각형 안 인원 = 재실 인원 → 오픈스페이스

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


def load_zones(path: Path, default_resource: str) -> list[dict]:
    """zone 파일을 읽어 구역 목록으로 정규화합니다.
    새 형식: {"zones": [{"resource_id", "type": "queue"|"room", "polygon", "pass_line"}]}
    옛 형식(구역 하나): {"queue_polygon", "pass_line"} → resource_id 는 --resource 값."""
    with open(path, encoding="utf-8") as f:
        cfg = json.load(f)
    if "zones" in cfg:
        return cfg["zones"]
    return [{"resource_id": default_resource, "type": "queue", "polygon": cfg["queue_polygon"],
             "pass_line": cfg.get("pass_line"), "line_count_direction": cfg.get("line_count_direction", "both")}]


class DwellTracker:
    """추적 ID 별로 구역에 처음 들어온 시각을 기억해 '평균 체류 시간' 을 냅니다.
    줄에서는 = 실제로 기다린 시간(대기시간 계산의 검증값), 실내에서는 = 머무는 시간."""

    def __init__(self, window_sec: float = 120.0):
        self.first_seen: dict[int, float] = {}
        self.finished: deque[tuple[float, float]] = deque()   # (나간 시각, 체류 초)
        self.window = window_sec

    def update(self, ids_in_zone: set[int], t: float) -> None:
        for i in ids_in_zone:
            self.first_seen.setdefault(i, t)
        for i in list(self.first_seen):
            if i not in ids_in_zone:
                self.finished.append((t, t - self.first_seen.pop(i)))
        while self.finished and t - self.finished[0][0] > self.window:
            self.finished.popleft()

    def avg_sec(self) -> float | None:
        if not self.finished:
            return None
        return round(sum(d for _, d in self.finished) / len(self.finished), 1)


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

    zones_cfg = load_zones(Path(args.zone), args.resource)
    model = YOLO(args.model)
    tracker = sv.ByteTrack()

    def build_zones():
        """구역별 계수 도구 묶음. 루프 재생 시 다시 만들기 위해 함수로 둡니다."""
        built = []
        for z in zones_cfg:
            poly = np.array(z["polygon"], dtype=np.int64)
            line = z.get("pass_line")
            pz = sv.PolygonZone(polygon=poly, triggering_anchors=(sv.Position.BOTTOM_CENTER,))
            lz = sv.LineZone(start=sv.Point(*line["start"]), end=sv.Point(*line["end"]),
                             triggering_anchors=(sv.Position.BOTTOM_CENTER,)) if line else None
            built.append({
                "cfg": z, "zone": pz, "line": lz, "thr": ThroughputCounter(60.0, 0.0), "dwell": DwellTracker(),
                "counts": deque(), "conf": deque(maxlen=50),
                "zone_annot": sv.PolygonZoneAnnotator(zone=pz, color=sv.Color.GREEN if z.get("type", "queue") == "queue" else sv.Color.BLUE, thickness=3),
                "line_annot": sv.LineZoneAnnotator(thickness=3, text_scale=1.0) if lz else None,
            })
        return built

    zones = build_zones()
    box_annot = sv.BoxAnnotator(thickness=2)   # --show 용. 화면에 그리기만 함

    src = int(args.source) if str(args.source).isdigit() else args.source
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        sys.exit(f"영상을 열 수 없습니다: {args.source}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    is_file = not isinstance(src, int)

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
                # 반복 재생 시 추적 ID 가 이어지지 않도록 트래커와 구역 계수기를 새로 만듭니다.
                tracker = sv.ByteTrack()
                zones = build_zones()
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

        # 3~5. 구역별 인원·처리율·체류시간 계산
        results = []
        for zc in zones:
            in_zone = zc["zone"].trigger(det)
            zone_count = int(in_zone.sum())
            zc["counts"].append((video_t, zone_count))
            while zc["counts"] and video_t - zc["counts"][0][0] > args.smooth_sec:
                zc["counts"].popleft()
            smoothed = int(statistics.median(c for _, c in zc["counts"]))
            if len(det.confidence) > 0:
                zc["conf"].extend(det.confidence[in_zone].tolist() if in_zone.any() else det.confidence.tolist())
            ids = set(int(i) for i in det.tracker_id[in_zone]) if det.tracker_id is not None and in_zone.any() else set()
            zc["dwell"].update(ids, video_t)
            thr = None
            if zc["line"] is not None:
                ci, co = zc["line"].trigger(det)
                n_cross = int(ci.sum() + co.sum()) if zc["cfg"].get("line_count_direction", "both") == "both" else int(ci.sum())
                zc["thr"].add(video_t, n_cross)
                thr = zc["thr"].per_minute(video_t)
            est = round(smoothed / thr, 1) if thr else None
            confidence = round(float(np.mean(zc["conf"])), 3) if zc["conf"] else 0.0
            results.append({"resource_id": zc["cfg"]["resource_id"], "zone_type": zc["cfg"].get("type", "queue"),
                            "people_count": smoothed, "throughput_per_min": thr, "confidence": confidence,
                            "avg_dwell_sec": zc["dwell"].avg_sec(), "device_id": args.device_id, "_raw": zone_count, "_est": est})

        # 6. 숫자만 전송 (interval 초마다, 구역마다 1건)
        if time.time() - last_sent >= args.interval:
            last_sent = time.time()
            for res in results:
                payload = {k: v for k, v in res.items() if not k.startswith("_")}
                print(f"t={video_t:6.1f}s [{res['resource_id']}/{res['zone_type']}] raw={res['_raw']:2d} n={res['people_count']:2d} "
                      f"thr/min={res['throughput_per_min']} wait={res['_est']} dwell={res['avg_dwell_sec']}s conf={res['confidence']}")
                if not args.dry_run:
                    try:
                        session.post(f"{args.api}/api/vision/metrics", json=payload,
                                     headers={"X-Device-Key": args.device_key}, timeout=3)
                    except requests.RequestException as e:
                        print("  [send failed]", e)

        if args.show:
            vis = box_annot.annotate(frame.copy(), det)
            for zc, res in zip(zones, results):
                vis = zc["zone_annot"].annotate(vis)
                if zc["line_annot"]:
                    vis = zc["line_annot"].annotate(vis, zc["line"])
            y = 60
            for res in results:
                cv2.putText(vis, f"{res['resource_id']}: n={res['people_count']} thr={res['throughput_per_min']} wait={res['_est']} dwell={res['avg_dwell_sec']}",
                            (30, y), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 255), 2)
                y += 36
            cv2.imshow("queue counter (not recorded)", vis)
            # 종료 키는 ESC 만. 'q' 는 한글 ㅂ 입력에 반응해 조용히 꺼지는 사고가 있었습니다.
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
