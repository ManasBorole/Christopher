"""Export mascot originals to web-sized WebP for frontend/public/mascot.

The original PNG renders live only on the designer's machine (git-ignored);
drop them into design/mascot/ before running this.

Usage: python design/mascot/export.py
"""
from pathlib import Path

from PIL import Image

SRC = Path(__file__).parent
OUT = SRC.parent.parent / "frontend" / "public" / "mascot"
WIDTH = 720  # renders at up to ~360 CSS px, so this stays sharp on 2x screens
SKIP = {"master"}  # reference sheet, not shown in the app

OUT.mkdir(parents=True, exist_ok=True)
for png in sorted(SRC.glob("*.png")):
    if png.stem in SKIP:
        continue
    im = Image.open(png).convert("RGB")
    h = round(im.height * WIDTH / im.width)
    dest = OUT / f"{png.stem}.webp"
    im.resize((WIDTH, h), Image.LANCZOS).save(dest, "WEBP", quality=80, method=6)
    print(f"{dest.name:20} {dest.stat().st_size // 1024:4d} KB")
