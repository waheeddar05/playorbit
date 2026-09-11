#!/usr/bin/env python3
"""
Cut the bats out of the KIS masters so they can be re-staged.

Reads kis-inbox/hires/<handle>/<file>, writes kis-inbox/cutouts/<name>.png
(RGBA, trimmed to the subject with a little padding, capped at MAX_H tall).

    ~/.venvs/po-photos/bin/python scripts/kis-creatives/cutout.py            # all
    ~/.venvs/po-photos/bin/python scripts/kis-creatives/cutout.py reserve-face

The masters come from kis-inbox/fetch-hires.sh (the reseller's Shopify
products.json, vendor "Khan International Sports", full-size originals).
Uses rembg's isnet-general-use, BiRefNet for the HARD set; first run
downloads the models to ~/.rembg.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pillow_heif
from PIL import Image, ImageFilter, ImageOps
from rembg import new_session, remove

pillow_heif.register_heif_opener()

ROOT = Path(__file__).resolve().parents[2]
HIRES = ROOT / "kis-inbox" / "hires"
OUT = ROOT / "kis-inbox" / "cutouts"
MAX_H = 2600

# name -> (handle, filename)
PICKS = {
    # Reserve Edition, 4000x6000 studio on white — the sharpest masters we have
    "reserve-face": ("best-cricket-bat-for-leather-ball-kis-reserve-edition-kashmir-willow-kis-bat", "reserve-edition-front-face-kis-cricket-bat.webp"),
    "reserve-edge": ("best-cricket-bat-for-leather-ball-kis-reserve-edition-kashmir-willow-kis-bat", "reserve-edition-edge-side-face-kis-cricket-bat-smooth.webp"),
    "reserve-side": ("best-cricket-bat-for-leather-ball-kis-reserve-edition-kashmir-willow-kis-bat", "reserve-edition-side-face-kis-cricket-bat-smooth.webp"),
    # Classic (KW listing reuses the EW studio set)
    "classic-face": ("kis-bat-kashmir-willow-from-kashmir-classic-kis", "English-willow-kis-bat_b937b695-3e4a-4e87-96da-b5804d09de58.webp"),
    "classic-side": ("kis-bat-kashmir-willow-from-kashmir-classic-kis", "side-blade-classic-english-willow-kis_d2642b66-9d23-45b1-83ff-cec19b9e0920.webp"),
    "classic-angle": ("kis-bat-kashmir-willow-from-kashmir-classic-kis", "KIS-english-willow-classic_d6049b78-8272-4ff9-837e-675871cd7e76.webp"),
    # Legends Edition
    "legends-face": ("kashmir-willow-kis-bat-for-leather-ball-legends-edition-kis", "Kis-kashmir-willow-legend-edition.webp"),
    "legends-angle": ("kashmir-willow-kis-bat-for-leather-ball-legends-edition-kis", "Kis-bat-kashmir-willow-legend.webp"),
    # AM Unstoppable
    "am-face": ("kis-kashmir-willow-bat-am-unstoppable", "KIS-bat-AM-edition-front-face.webp"),
    "am-angle": ("kis-kashmir-willow-bat-am-unstoppable", "am-unstoable-kis-bat.webp"),
    "am-pair": ("kis-kashmir-willow-bat-am-unstoppable", "side-and-front-am-kis-bat.webp"),
    # Professional Edition
    "pro-face": ("kis-bat-kashmir-willow-professional-edition", "front-face-of-kis-bat-kashmir-willow.webp"),
    "pro-edge": ("kis-bat-kashmir-willow-professional-edition", "kis-bat-kashmir-willow-edge-and-shape.webp"),
    "pro-angle": ("kis-bat-kashmir-willow-professional-edition", "professional-blade-kis-bat.webp"),
    # Limited Edition
    "limited-face": ("kashmir-willow-kis-bat-for-leather-ball-limited-edition", "kis-bat-kashmir-willow-limited-edition-frontface.webp"),
    "limited-grains": ("kashmir-willow-kis-bat-for-leather-ball-limited-edition", "limited-edition-grains.webp"),
    # Grade A+ on black
    "gradea-face": ("cricket-bat-for-leather-bat-kis-grade-a", "kashmir_willow_KIS_bat_b.webp"),
    "gradea-angle": ("cricket-bat-for-leather-bat-kis-grade-a", "kashmir_willow_KIS_bat_a.webp"),
    # Lifestyle masters where the bat is clearly separable
    "mh7000-face": ("m-h7000-best-kashmir-willow-cricket-bat-for-leather-ball-kis-unstoppable", "mh7000-kis-bat-front-face.jpg"),
    # Accessories
    "pads-white": ("batting-pads-batting-leg-guard-shop-now", "ChatGPTImageAug18_2026_02_52_34PM.png"),
}

# White blade on white paper fools isnet; these get the heavier BiRefNet pass.
HARD = {"am-face", "pro-face", "gradea-face", "gradea-angle", "pads-white"}


def load(path: Path) -> Image.Image:
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)
    return im.convert("RGBA")


def trim(im: Image.Image, pad: int = 24) -> Image.Image:
    alpha = np.asarray(im.split()[-1])
    ys, xs = np.where(alpha > 8)
    if len(xs) == 0:
        return im
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, im.width)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad, im.height)
    return im.crop((x0, y0, x1, y1))


def clean_alpha(im: Image.Image) -> Image.Image:
    """Kill faint halo pixels and soften the edge by one pixel."""
    r, g, b, a = im.split()
    arr = np.asarray(a).astype(np.float32)
    arr = np.clip((arr - 12) * (255.0 / (255 - 12)), 0, 255)
    a = Image.fromarray(arr.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    return Image.merge("RGBA", (r, g, b, a))


def main(names: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sessions: dict[str, object] = {}
    todo = names or list(PICKS)
    for name in todo:
        handle, fn = PICKS[name]
        src = HIRES / handle / fn
        dst = OUT / f"{name}.png"
        if not src.exists():
            print(f"MISSING {name}: {src}")
            continue
        model = "birefnet-general" if name in HARD else "isnet-general-use"
        session = sessions.setdefault(model, new_session(model))
        im = load(src)
        if im.height > 3200:  # rembg works at 1024 internally; no need to feed it 6000px
            im = im.resize((round(im.width * 3200 / im.height), 3200), Image.LANCZOS)
        cut = remove(im, session=session, post_process_mask=True)
        cut = clean_alpha(trim(cut))
        if cut.height > MAX_H:
            cut = cut.resize((round(cut.width * MAX_H / cut.height), MAX_H), Image.LANCZOS)
        cut.save(dst, optimize=True)
        print(f"ok {name:18s} {cut.width}x{cut.height}  <- {fn}")


if __name__ == "__main__":
    main(sys.argv[1:])
