"""
여러 영상·구역을 한 번에 분석: vision/manifest.json 의 job 마다 run_video.py 프로세스를 하나씩 띄웁니다.

왜 프로세스 분리인가: YOLO 추론은 CPU 를 많이 쓰므로 영상마다 별도 프로세스가 가장 단순하고(GIL 회피),
하나가 죽어도 나머지는 계속 돕니다. 실제 현장에서는 카메라마다 Raspberry Pi 한 대가 이 역할을 합니다.

실행:  .venv/bin/python vision/run_all.py            # 매니페스트 전체
       .venv/bin/python vision/run_all.py --show     # 창도 띄움 (영상 수만큼 창)
Ctrl-C 로 전부 종료.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default="vision/manifest.json")
    ap.add_argument("--show", action="store_true")
    ap.add_argument("--api", default="http://localhost:8000")
    args = ap.parse_args()
    jobs = json.loads(Path(args.manifest).read_text(encoding="utf-8"))["jobs"]
    procs = []
    for j in jobs:
        cmd = [sys.executable, "vision/run_video.py", "--zone", j["zone"], "--api", args.api, *j.get("args", [])]
        if j.get("source"):
            cmd += ["--source", j["source"]]
        if j.get("resource"):
            cmd += ["--resource", j["resource"]]
        if args.show:
            cmd.append("--show")
        print(f"[run_all] start: {j['name']}\n         {' '.join(cmd)}")
        procs.append(subprocess.Popen(cmd))
        time.sleep(1)   # 모델 로딩이 겹치지 않게 살짝 간격
    try:
        while any(p.poll() is None for p in procs):
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[run_all] 종료 중…")
        for p in procs:
            p.terminate()
    for p in procs:
        p.wait(timeout=10)


if __name__ == "__main__":
    main()
