"""
시간대별 혼잡도 예측 (Should). 과거 vision_metrics 를 요일×30분 슬롯으로 묶어 평균 대기시간 → 3단계로 저장합니다.

모델이라기보다 "과거 평균" 입니다. 데이터가 쌓이면 scikit-learn 회귀로 바꿀 수 있지만,
설명 가능성과 데이터 양을 생각하면 학기 내에는 평균이 가장 정직한 방법입니다.

실행:  .venv/bin/python jobs/predict.py --db server/data/app.db
"""
from __future__ import annotations

import argparse
import sqlite3
from collections import defaultdict
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")   # 배포 서버가 UTC 여도 한국 시각 기준으로 슬롯을 나눔


def level(wait_min: float) -> str:
    if wait_min <= 5:
        return "relaxed"
    if wait_min <= 12:
        return "normal"
    return "crowded"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="server/data/app.db")
    args = ap.parse_args()
    conn = sqlite3.connect(args.db)
    buckets: dict[tuple, list[float]] = defaultdict(list)
    for rid, wait, created in conn.execute("SELECT resource_id, est_wait_min, created_at FROM vision_metrics WHERE est_wait_min IS NOT NULL"):
        dt = datetime.fromisoformat(created).astimezone(KST)
        slot = f"{dt.hour:02d}:{'30' if dt.minute >= 30 else '00'}"
        buckets[(rid, dt.weekday(), slot)].append(wait)
    n = 0
    for (rid, wd, slot), waits in buckets.items():
        if len(waits) < 5:      # 표본이 너무 적으면 시드값을 유지
            continue
        conn.execute("INSERT OR REPLACE INTO predictions VALUES (?,?,?,?,?)",
                     (rid, wd, slot, level(sum(waits) / len(waits)), f"avg-{datetime.now(timezone.utc).date()}"))
        n += 1
    conn.commit()
    print(f"updated {n} prediction slots")


if __name__ == "__main__":
    main()
