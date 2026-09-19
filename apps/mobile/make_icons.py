"""
Android 앱 아이콘·스플래시 생성기. 원본: assets/brand/app-icon-source.webp (팀이 준 앱 아이콘)

만드는 것
- mipmap-*/ic_launcher.png, ic_launcher_round.png : 옛 안드로이드용 아이콘 (48~192px)
- mipmap-*/ic_launcher_foreground.png            : 안드로이드 8+ 적응형 아이콘 앞면 (108dp 캔버스)
  런처가 원·물방울 모양으로 가장자리 18dp 를 잘라내므로, 그림을 가운데 80% 크기로 넣고 바깥은 투명.
  뒤판 색(ic_launcher_background)은 원본 가장자리의 남색으로 맞춰 잘린 부분이 자연스럽게 이어지게 합니다.
- drawable*/splash.png : 흰 바탕 가운데 아이콘 (앱 켤 때 잠깐 보이는 화면)

실행: .venv/bin/python apps/mobile/make_icons.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
RES = ROOT / "apps/mobile/android/app/src/main/res"
src = Image.open(ROOT / "assets/brand/app-icon-source.webp").convert("RGBA")
s = min(src.size)
src = src.crop(((src.width - s) // 2, (src.height - s) // 2, (src.width + s) // 2, (src.height + s) // 2))

# 둥근 사각형 바깥의 흰 모서리를 투명하게 (테두리에서 연결된 흰색만)
rgb = src.convert("RGB")
for xy in [(0, 0), (s - 1, 0), (0, s - 1), (s - 1, s - 1)]:
    ImageDraw.floodfill(rgb, xy, (255, 0, 255), thresh=40)
a = np.array(src); m = np.array(rgb)
a[(m[..., 0] == 255) & (m[..., 1] == 0) & (m[..., 2] == 255), 3] = 0
icon = Image.fromarray(a)

# 뒤판 색 = 아이콘 위쪽 가장자리 근처 남색 평균
edge = np.array(src.convert("RGB"))[int(s * 0.06):int(s * 0.10), int(s * 0.3):int(s * 0.7)].reshape(-1, 3).mean(0)
bg_hex = "#{:02x}{:02x}{:02x}".format(*[int(v) for v in edge])

LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for d, px in LEGACY.items():
    out = RES / f"mipmap-{d}"
    out.mkdir(parents=True, exist_ok=True)
    icon.resize((px, px), Image.LANCZOS).save(out / "ic_launcher.png")
    # 둥근 아이콘: 원형 마스크
    mask = Image.new("L", (px, px), 0); ImageDraw.Draw(mask).ellipse((0, 0, px - 1, px - 1), fill=255)
    rnd = Image.new("RGBA", (px, px), (0, 0, 0, 0)); rnd.paste(src.resize((px, px), Image.LANCZOS), (0, 0), mask)
    rnd.save(out / "ic_launcher_round.png")
    # 적응형 앞면: 108dp 캔버스(=px*2.25) 가운데 80% 크기
    fg_px = int(px * 2.25)
    fg = Image.new("RGBA", (fg_px, fg_px), (0, 0, 0, 0))
    inner = int(fg_px * 0.80)
    fg.alpha_composite(icon.resize((inner, inner), Image.LANCZOS), ((fg_px - inner) // 2, (fg_px - inner) // 2))
    fg.save(out / "ic_launcher_foreground.png")

(RES / "values/ic_launcher_background.xml").write_text(
    f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{bg_hex}</color>\n</resources>\n')

# 스플래시: 기존 splash.png 들과 같은 크기로, 흰 바탕 가운데 아이콘
for p in RES.glob("drawable*/splash.png"):
    w, h = Image.open(p).size
    canvas = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    side = int(min(w, h) * 0.32)
    canvas.alpha_composite(icon.resize((side, side), Image.LANCZOS), ((w - side) // 2, (h - side) // 2))
    canvas.convert("RGB").save(p)
print("icons ok, background", bg_hex)
