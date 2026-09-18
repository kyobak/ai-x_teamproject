"""
정확도 평가 (REQ-VIS-04): 정답 인원 수와 모델 계수 결과를 비교해 MAE 와 3단계 분류 정확도를 계산합니다.

입력 CSV 형식 (헤더 필수):  frame,gt_count,pred_count
 - gt_count  : 사람이 직접 센 정답 (공개 데이터셋 어노테이션이나 연출 영상의 수동 계수)
 - pred_count: run_video.py 가 같은 프레임에서 센 값 (--dry-run 출력을 옮겨 적거나 스크립트로 저장)

실행:  .venv/bin/python vision/eval/eval_counts.py --csv vision/eval/sample_eval.csv

MAE 가 목표(잠정 2명)를 넘으면 계획서대로 지표를 '혼잡 3단계 분류 정확도' 로 바꿀 수 있게 둘 다 출력합니다.
영상 파일 자체는 커밋하지 않고, 이 CSV(숫자) 만 커밋합니다.
"""
from __future__ import annotations

import argparse
import csv


def level(n: int) -> str:
    """인원 수 → 3단계. 경계는 현장 관찰로 조정합니다."""
    if n <= 5:
        return "relaxed"
    if n <= 15:
        return "normal"
    return "crowded"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--target-mae", type=float, default=2.0)
    args = ap.parse_args()
    rows = list(csv.DictReader(open(args.csv, encoding="utf-8")))
    if not rows:
        raise SystemExit("빈 CSV")
    errs = [abs(int(r["gt_count"]) - int(r["pred_count"])) for r in rows]
    mae = sum(errs) / len(errs)
    acc = sum(level(int(r["gt_count"])) == level(int(r["pred_count"])) for r in rows) / len(rows)
    print(f"프레임 수      : {len(rows)}")
    print(f"MAE (명)       : {mae:.2f}  (목표 ≤ {args.target_mae})  → {'통과' if mae <= args.target_mae else '미달'}")
    print(f"3단계 분류 정확도: {acc*100:.1f}%")


if __name__ == "__main__":
    main()
