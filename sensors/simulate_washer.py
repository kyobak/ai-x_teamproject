"""
세탁기 진동 센서 시뮬레이터. 실제 센서(ESP32 + MPU6050) 대신 "한 사이클" 의 진동 프로파일을 서버에 보냅니다.

프로파일 (계획서의 판정 규칙을 검증할 수 있게 중간 정지 구간을 넣었습니다):
  단계        실제 길이   진동
  급수         1분       없음      ← 사용 시작 전
  세탁        12분       중간
  불림/배수    3분       없음      ← T(5분) 보다 짧으므로 종료로 오판하면 안 됨
  헹굼        10분       중간
  배수         2분       없음
  탈수         6분       강함      ← 가장 큰 진동
  종료 후    (무한)      없음      ← 5분 무진동 후 '사용 가능' 판정
  합계 약 34분 (기본값 50분보다 짧음 → 예상 종료보다 실제가 빠른 경우를 시연)

--speed 20 이면 20배 빨리(34분 → 약 1분 40초). 기본값은 샘플의 ts 를 "가상 시각" 으로 보내므로 서버의 판정 규칙(30초, 5분)은
그대로 검증되지만, 화면의 "남은 분" 은 실제 시계와 어긋납니다.
화면까지 자연스럽게 보이려면 서버를 DEMO_TIME_SCALE=20 으로 띄우고 --no-virtual-ts 를 붙이세요 (ts 없이 보내 서버 수신 시각 사용).

실행:  .venv/bin/python sensors/simulate_washer.py --resource laundry-w1 --speed 20
       DEMO_TIME_SCALE=20 uvicorn ...  +  simulate_washer.py --speed 20 --no-virtual-ts
"""
from __future__ import annotations

import argparse
import random
import time
from datetime import datetime, timedelta, timezone

import requests

PROFILE = [  # (단계 이름, 분, 진동 세기 평균 g)
    ("급수", 1, 0.0), ("세탁", 12, 0.35), ("불림/배수", 3, 0.0), ("헹굼", 10, 0.3),
    ("배수", 2, 0.0), ("탈수", 6, 0.9), ("종료", 7, 0.0),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--resource", default="laundry-w1")
    ap.add_argument("--api", default="http://localhost:8000")
    ap.add_argument("--device-key", default="dev-edge-key")
    ap.add_argument("--speed", type=float, default=20.0, help="시간 배속")
    ap.add_argument("--sample-sec", type=float, default=10.0, help="가상 시간 기준 샘플 간격(초)")
    ap.add_argument("--loop", action="store_true")
    ap.add_argument("--no-virtual-ts", action="store_true", help="ts 를 보내지 않음 (서버 DEMO_TIME_SCALE 과 함께 사용)")
    args = ap.parse_args()

    virtual = datetime.now(timezone.utc)
    while True:
        for stage, minutes, mean in PROFILE:
            print(f"--- {stage} ({minutes}분, 진동≈{mean}g) ---")
            n = int(minutes * 60 / args.sample_sec)
            for _ in range(n):
                mag = max(0.0, random.gauss(mean, 0.05)) if mean > 0 else abs(random.gauss(0, 0.01))
                payload = {"resource_id": args.resource, "magnitude": round(mag, 3)}
                if not args.no_virtual_ts:
                    payload["ts"] = virtual.isoformat()
                try:
                    r = requests.post(f"{args.api}/api/sensors/vibration", json=payload,
                                      headers={"X-Device-Key": args.device_key}, timeout=3).json()
                    if r.get("event"):
                        print(f"  {virtual.strftime('%H:%M:%S')} mag={mag:.2f} -> state={r['state']} EVENT={r['event']}")
                except requests.RequestException as e:
                    print("send failed:", e)
                virtual += timedelta(seconds=args.sample_sec)
                time.sleep(args.sample_sec / args.speed)
        if not args.loop:
            break


if __name__ == "__main__":
    main()
