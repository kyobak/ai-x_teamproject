"""
YOLO 없이 대시보드를 시연할 때 쓰는 가짜 수치 생성기.

- 노트북에 torch 가 안 깔리거나, 영상 없이 화면만 보여줄 때 사용합니다.
- 점심 피크 곡선처럼 인원이 서서히 늘었다 줄고, 처리율은 5~8명/분 사이에서 흔들립니다.

실행:  .venv/bin/python vision/simulate_metrics.py --resource cafeteria-1 --interval 2
"""
from __future__ import annotations

import argparse
import math
import random
import time

import requests


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--resource", default="cafeteria-1")
    ap.add_argument("--api", default="http://localhost:8000")
    ap.add_argument("--device-key", default="dev-edge-key")
    ap.add_argument("--interval", type=float, default=2.0)
    ap.add_argument("--no-line", action="store_true", help="통과선 없음 시나리오(처리율 None → 서버가 상수 사용)")
    args = ap.parse_args()
    t0 = time.time()
    while True:
        t = time.time() - t0
        # 4분 주기의 파도: 0~40명
        people = max(0, int(20 + 20 * math.sin(t / 240 * 2 * math.pi) + random.randint(-2, 2)))
        thr = None if args.no_line else round(random.uniform(5, 8), 1)
        payload = {"resource_id": args.resource, "people_count": people, "throughput_per_min": thr,
                   "confidence": round(random.uniform(0.6, 0.9), 2), "device_id": "simulator"}
        try:
            r = requests.post(f"{args.api}/api/vision/metrics", json=payload,
                              headers={"X-Device-Key": args.device_key}, timeout=3)
            print(payload, "->", r.json())
        except requests.RequestException as e:
            print("send failed:", e)
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
