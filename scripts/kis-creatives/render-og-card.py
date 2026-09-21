#!/usr/bin/env python3
"""
Render the Cricket Store's share card — the 1200×630 image WhatsApp,
Instagram and Facebook show under a shared /shop or product link.

    python3 scripts/kis-creatives/render-og-card.py            # -> public/images/og-store.jpg
    python3 scripts/kis-creatives/render-og-card.py --preview  # also writes a PNG next to it

Needs Pillow (`pip install pillow`) and the Geist TTFs that ship inside
node_modules/geist, so run it after `npm ci`.

Composition: the snow shot of the M&H 7000 on the left, fading into a
PlayOrbit-navy panel on the right that carries the store name, the
model and the four claims from KIS_MODEL. Nothing here that changes in
the admin panel — no price, no "pre-booking open" — because the file is
static and a share preview is cached by WhatsApp for days; the price and
the launch state ride in og:title / og:description, which are generated
per request from the catalog row (see src/lib/marketplace-seo.ts).

The JPEG is stepped down in quality until it is under WhatsApp's
~300 KB preview ceiling; a bigger file is silently not shown at all.
"""
from __future__ import annotations

import argparse
import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
PHOTO = ROOT / "public" / "images" / "kis" / "snow.webp"
OUT = ROOT / "public" / "images" / "og-store.jpg"
FONTS = ROOT / "node_modules" / "geist" / "dist" / "fonts" / "geist-sans"

W, H = 1200, 630
# Where the photo gives way to the panel, in px from the left.
PHOTO_W = 640
FADE_W = 220

NAVY_TOP = (3, 7, 18)
NAVY_BOT = (10, 22, 40)
SKY = (56, 189, 248)
WHITE = (255, 255, 255)
SLATE = (148, 163, 184)
SLATE_DIM = (100, 116, 139)
AMBER = (252, 211, 77)

# Mirrors KIS_MODEL in src/lib/kis-showcase.ts — keep the two in step.
STORE = "PLAYORBIT CRICKET STORE"
BRAND = "KIS"
MODEL = "M&H 7000"
ORIGIN = "Anantnag, Kashmir"
CLAIMS = ["Grade A++ Kashmir willow", "Knocked in ready", "Hand-finished", "Made in Anantnag"]
TAGLINE = "One bat. Picked in person."
SITE = "playorbit.in/shop"

# WhatsApp stops showing a preview image somewhere above this.
MAX_BYTES = 290 * 1024


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    path = FONTS / f"Geist-{name}.ttf"
    if not path.exists():
        raise SystemExit(f"missing font {path} — run `npm ci` first")
    return ImageFont.truetype(str(path), size)


def vertical_gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    w, h = size
    strip = Image.new("RGB", (1, h))
    px = strip.load()
    for y in range(h):
        t = y / max(1, h - 1)
        px[0, y] = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return strip.resize((w, h))


def cover_crop(img: Image.Image, box: tuple[int, int], focal: tuple[float, float]) -> Image.Image:
    """Scale to cover `box`, then crop around the focal point (0..1, 0..1)."""
    bw, bh = box
    scale = max(bw / img.width, bh / img.height)
    scaled = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    fx, fy = focal
    left = min(max(round(scaled.width * fx - bw / 2), 0), scaled.width - bw)
    top = min(max(round(scaled.height * fy - bh / 2), 0), scaled.height - bh)
    return scaled.crop((left, top, left + bw, top + bh))


def render() -> Image.Image:
    canvas = vertical_gradient((W, H), NAVY_TOP, NAVY_BOT)

    # A soft accent glow behind the text so the panel is not flat navy.
    glow = Image.new("RGB", (W, H), NAVY_TOP)
    gd = ImageDraw.Draw(glow)
    gd.ellipse((760, -180, 1320, 300), fill=(14, 52, 78))
    gd.ellipse((620, 420, 1040, 820), fill=(38, 24, 66))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    canvas = Image.blend(canvas, glow, 0.55)

    # The photo, with its right edge dissolving into the panel. The focal
    # point matches kis-photos.ts ("50% 42%") so the blades stay in shot.
    photo = Image.open(PHOTO).convert("RGB")
    photo = cover_crop(photo, (PHOTO_W + FADE_W, H), (0.5, 0.42))
    mask = Image.new("L", photo.size, 255)
    md = ImageDraw.Draw(mask)
    for x in range(FADE_W):
        a = round(255 * (1 - x / FADE_W) ** 1.6)
        md.line([(PHOTO_W + x, 0), (PHOTO_W + x, H)], fill=a)
    md.rectangle((PHOTO_W + FADE_W, 0, photo.width, H), fill=0)
    canvas.paste(photo, (0, 0), mask)

    # A slight darkening at the very top and bottom so the frame holds.
    edge = Image.new("L", (W, H), 0)
    ed = ImageDraw.Draw(edge)
    for y in range(70):
        a = round(140 * (1 - y / 70))
        ed.line([(0, y), (W, y)], fill=a)
        ed.line([(0, H - 1 - y), (W, H - 1 - y)], fill=a)
    canvas.paste(Image.new("RGB", (W, H), NAVY_TOP), (0, 0), edge)

    d = ImageDraw.Draw(canvas)
    x = 700

    # Eyebrow.
    eyebrow = font("Bold", 22)
    y = 92
    cursor = x
    for ch in STORE:  # hand-tracked, PIL has no letter-spacing
        d.text((cursor, y), ch, font=eyebrow, fill=SKY)
        cursor += d.textlength(ch, font=eyebrow) + 5

    # Brand + origin line.
    small = font("SemiBold", 22)
    y = 150
    d.text((x, y), f"{BRAND}  ·  {ORIGIN.upper()}", font=small, fill=SLATE)

    # The model, as big as the panel allows: start oversized and step
    # down until it clears the right margin, so a longer model name
    # never runs off the card.
    size = 118
    big = font("BlackItalic", size)
    while size > 48 and d.textlength(MODEL, font=big) > (W - 60) - x:
        size -= 2
        big = font("BlackItalic", size)
    y = 188 + (118 - size) // 2
    d.text((x - 6, y), MODEL, font=big, fill=WHITE)

    # Tagline.
    tag = font("Bold", 34)
    y = 335
    d.text((x, y), TAGLINE, font=tag, fill=WHITE)

    # Claims as pills.
    pill_font = font("Medium", 21)
    y = 402
    cursor = x
    row_h = 44
    for claim in CLAIMS:
        tw = d.textlength(claim, font=pill_font)
        pw = round(tw) + 34
        if cursor + pw > W - 60:
            cursor = x
            y += row_h + 10
        d.rounded_rectangle((cursor, y, cursor + pw, y + row_h), radius=22, fill=(18, 30, 50), outline=(45, 62, 88), width=2)
        d.text((cursor + 17, y + 10), claim, font=pill_font, fill=(226, 232, 240))
        cursor += pw + 12

    # Footer: site + a small amber dot as the "live" cue.
    foot = font("SemiBold", 22)
    fy = H - 72
    d.ellipse((x, fy + 7, x + 12, fy + 19), fill=AMBER)
    d.text((x + 24, fy), SITE, font=foot, fill=SLATE_DIM)

    return canvas


def encode(img: Image.Image) -> bytes:
    for q in range(88, 50, -3):
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=q, optimize=True, progressive=True, subsampling=1)
        if buf.tell() <= MAX_BYTES:
            return buf.getvalue()
    return buf.getvalue()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--preview", action="store_true", help="also write a lossless PNG beside the JPEG")
    args = ap.parse_args()

    img = render()
    data = encode(img)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)
    print(f"wrote {out} ({len(data) // 1024} KB)")
    if args.preview:
        png = out.with_suffix(".png")
        img.save(png)
        print(f"wrote {png}")


if __name__ == "__main__":
    main()
