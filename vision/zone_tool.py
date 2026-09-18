"""
줄 구역(다각형)과 통과선을 마우스로 그려 zone JSON 을 만드는 도구.

사용:  .venv/bin/python vision/zone_tool.py --source 영상경로 --out vision/zones/cafeteria-1.json
  - 왼쪽 클릭: 다각형 꼭짓점 추가 (4개 이상)
  - 'l' 키 다음 두 번 클릭: 통과선 시작/끝
  - 's' 저장, 'r' 초기화, 'q' 종료

첫 프레임만 메모리에 띄우고, 저장하는 것은 좌표 JSON 뿐입니다(프레임은 저장하지 않음).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2

points: list[list[int]] = []
line: list[list[int]] = []
mode = "poly"


def on_mouse(event, x, y, flags, param):
    global mode
    if event != cv2.EVENT_LBUTTONDOWN:
        return
    if mode == "poly":
        points.append([x, y])
    else:
        line.append([x, y])
        if len(line) == 2:
            mode = "poly"


def main():
    global mode
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    src = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(src)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise SystemExit("영상을 열 수 없습니다")
    cv2.namedWindow("zone tool")
    cv2.setMouseCallback("zone tool", on_mouse)
    while True:
        vis = frame.copy()
        for i, p in enumerate(points):
            cv2.circle(vis, tuple(p), 6, (0, 255, 0), -1)
            if i:
                cv2.line(vis, tuple(points[i - 1]), tuple(p), (0, 255, 0), 2)
        if len(points) > 2:
            cv2.line(vis, tuple(points[-1]), tuple(points[0]), (0, 255, 0), 1)
        if len(line) == 2:
            cv2.line(vis, tuple(line[0]), tuple(line[1]), (0, 0, 255), 3)
        cv2.putText(vis, f"mode={mode}  click=polygon  l=line  s=save  r=reset  q=quit", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 0), 2)
        cv2.imshow("zone tool", vis)
        k = cv2.waitKey(30) & 0xFF
        if k == ord("q"):
            break
        if k == ord("l"):
            line.clear(); mode = "line"
        if k == ord("r"):
            points.clear(); line.clear(); mode = "poly"
        if k == ord("s") and len(points) >= 3:
            data = {"queue_polygon": points,
                    "pass_line": {"start": line[0], "end": line[1]} if len(line) == 2 else None,
                    "line_count_direction": "both"}
            Path(args.out).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            print("saved", args.out)
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
