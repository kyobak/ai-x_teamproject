"""
검출 모델 비교 실험 (Should): 같은 영상·같은 구역에서 yolo11n vs yolo11s (원하면 더) 의 구역 인원 수와 속도를 비교합니다.

출력: 프레임별 인원 수 CSV(vision/eval/compare_<model>.csv) + 평균 인원·평균 추론 시간 요약.
정답 CSV(our_eval.csv) 가 있으면 eval_counts.py 로 각 모델의 MAE 를 따로 계산하세요.

실행:  .venv/bin/python vision/eval/compare_models.py --source vision/samples/demo.mp4 --models yolo11n.pt yolo11s.pt --stride 25
"""
from __future__ import annotations

import argparse
import csv
import json
import time
from pathlib import Path

import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="vision/samples/people-walking.mp4")
    ap.add_argument("--zone", default="vision/zones/cafeteria-1.json")
    ap.add_argument("--models", nargs="+", default=["yolo11n.pt", "yolo11s.pt"])
    ap.add_argument("--stride", type=int, default=25, help="n 프레임마다 1번 (정답 CSV 의 frame 간격과 맞출 것)")
    ap.add_argument("--conf", type=float, default=0.3)
    args = ap.parse_args()

    polygon = np.array(json.load(open(args.zone, encoding="utf-8"))["queue_polygon"], dtype=np.int64)
    zone = sv.PolygonZone(polygon=polygon, triggering_anchors=(sv.Position.BOTTOM_CENTER,))
    for name in args.models:
        model = YOLO(name)
        cap = cv2.VideoCapture(args.source)
        rows, times = [], []
        idx = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if idx % args.stride == 0:
                t0 = time.perf_counter()
                det = sv.Detections.from_ultralytics(model(frame, classes=[0], conf=args.conf, verbose=False)[0])
                times.append(time.perf_counter() - t0)
                rows.append((idx, int(zone.trigger(det).sum())))
            idx += 1
        cap.release()
        out = Path("vision/eval") / f"compare_{Path(name).stem}.csv"
        with open(out, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f); w.writerow(["frame", "pred_count"]); w.writerows(rows)
        print(f"{name:12s} 프레임 {len(rows)}개 · 평균 인원 {np.mean([c for _, c in rows]):.1f} · 추론 {np.mean(times)*1000:.0f} ms/프레임 → {out}")


if __name__ == "__main__":
    main()
