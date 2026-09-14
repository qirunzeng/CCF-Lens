#!/usr/bin/env python3
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUTPUT = Path(__file__).resolve().parents[1] / "WebExtension" / "icons"
OUTPUT.mkdir(parents=True, exist_ok=True)
APP_ICON = Path(__file__).resolve().parents[1] / "Safari" / "App" / "Assets.xcassets" / "AppIcon.appiconset"
APP_ICON.mkdir(parents=True, exist_ok=True)

for size in (16, 32, 48, 64, 128, 256, 512, 1024):
    scale = 4
    canvas = Image.new("RGBA", (size * scale, size * scale), (15, 23, 42, 255))
    draw = ImageDraw.Draw(canvas)
    inset = round(size * scale * 0.11)
    draw.rounded_rectangle(
        (inset, inset, size * scale - inset, size * scale - inset),
        radius=round(size * scale * 0.22),
        fill=(37, 99, 235, 255),
    )
    font = ImageFont.truetype("/System/Library/Fonts/SFNSRounded.ttf", round(size * scale * 0.42))
    draw.text((size * scale / 2, size * scale / 2), "C", font=font, fill="white", anchor="mm")
    icon = canvas.resize((size, size), Image.Resampling.LANCZOS)
    icon.save(OUTPUT / f"icon-{size}.png")
    icon.save(APP_ICON / f"icon-{size}.png")
