"""
데모용 샘플 영상 다운로드. Roboflow supervision 이 배포하는 공개 데모 영상(보행자)을 vision/samples/ 에 받습니다.
영상 파일은 .gitignore 로 커밋되지 않습니다. 실제 학식 영상은 동의서를 받은 연출 영상만 사용합니다(ETHICS.md).

실행:  .venv/bin/python vision/download_sample.py
"""
import os
from pathlib import Path

from supervision.assets import VideoAssets, download_assets

out = Path(__file__).parent / "samples"
out.mkdir(exist_ok=True)
os.chdir(out)
path = download_assets(VideoAssets.PEOPLE_WALKING)   # 1920x1080, 25fps, 약 14초
print("saved:", out / path)
