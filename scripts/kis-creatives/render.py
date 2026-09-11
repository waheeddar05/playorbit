#!/usr/bin/env python3
"""
Render PlayOrbit's own KIS creatives from the cutouts.

    ~/.venvs/po-photos/bin/python scripts/kis-creatives/render.py band            # 1600x900, no text, loops -> landing band
    ~/.venvs/po-photos/bin/python scripts/kis-creatives/render.py reel            # 1080x1920, typeset -> Reels / WhatsApp status
    ~/.venvs/po-photos/bin/python scripts/kis-creatives/render.py square          # 1080x1080, typeset -> feed
    ~/.venvs/po-photos/bin/python scripts/kis-creatives/render.py stills          # band poster + 4:5 cards
    ~/.venvs/po-photos/bin/python scripts/kis-creatives/render.py band --preview  # contact sheet to ~/.openclaw/workspace/tmp/kis-audit

Outputs land in kis-inbox/renders/. Copy kis-hero.mp4 / kis-gear-band.jpg into
public/images/ under a bumped -vN name and point SHOP_BAND at them.

Needs the po-photos venv: pip install pillow numpy pillow-heif "rembg[cpu]".
Copy is in COPY below; scene timing in SCENES.

Nothing here is KIS footage: every frame is composited from bat cutouts on a
dark PlayOrbit stage, so the result is ours to use however we like.
"""
from __future__ import annotations

import math
import os
import subprocess
import sys
from dataclasses import dataclass, field
from functools import lru_cache
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
CUT = ROOT / "kis-inbox" / "cutouts"
HIRES = ROOT / "kis-inbox" / "hires"
OUT = ROOT / "kis-inbox" / "renders"
FONTS = ROOT / "node_modules" / "geist" / "dist" / "fonts" / "geist-sans"
PREVIEW_DIR = Path.home() / ".openclaw" / "workspace" / "tmp" / "kis-audit"

FPS = 30
NAVY_TOP = (3, 7, 18)
NAVY_MID = (10, 22, 40)
NAVY_BOT = (5, 11, 20)
SKY = (56, 189, 248)
SKY_LIGHT = (125, 211, 252)
PURPLE = (168, 85, 247)
WHITE = (255, 255, 255)
SLATE = (148, 163, 184)

BACKDROP = HIRES / "m-h7000-best-kashmir-willow-cricket-bat-for-leather-ball-kis-unstoppable" / "top-grade-leather-bat-mh700-kis.jpg"
MOUNTAINS = HIRES / "players-special-top-grade-wood-kashmir-willow-cricket-bat" / "kis-bat-players-special-edge-view.jpg"

# ----------------------------------------------------------------- easing --


def clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def ease_out_expo(x: float) -> float:
    x = clamp01(x)
    return 1.0 if x >= 1 else 1 - math.pow(2, -10 * x)


def ease_in_out_cubic(x: float) -> float:
    x = clamp01(x)
    return 4 * x * x * x if x < 0.5 else 1 - math.pow(-2 * x + 2, 3) / 2


def ease_out_back(x: float, s: float = 0.9) -> float:
    x = clamp01(x)
    c1, c3 = s, s + 1
    return 1 + c3 * math.pow(x - 1, 3) + c1 * math.pow(x - 1, 2)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def seg(t: float, start: float, dur: float) -> float:
    """0..1 progress of t through [start, start+dur]."""
    return clamp01((t - start) / dur) if dur > 0 else 1.0


# ---------------------------------------------------------------- sprites --


@lru_cache(maxsize=None)
def cutout(name: str) -> Image.Image:
    """Cutout with a touch of warm key light so willow reads as willow on the navy stage."""
    im = Image.open(CUT / f"{name}.png").convert("RGBA")
    r, g, b, a = im.split()
    rgb = Image.merge("RGB", (r, g, b))
    rgb = ImageEnhance.Contrast(ImageEnhance.Brightness(rgb).enhance(1.07)).enhance(1.06)
    arr = np.asarray(rgb).astype(np.float32)
    arr[..., 0] *= 1.025  # warm
    arr[..., 2] *= 0.985
    rgb = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
    r, g, b = rgb.split()
    return Image.merge("RGBA", (r, g, b, a))


def split_columns(im: Image.Image, min_gap_frac: float = 0.02) -> list[Image.Image]:
    """Split a front+back pair into two sprites at the widest empty column gap."""
    a = np.asarray(im.split()[-1])
    cols = (a > 10).sum(axis=0)
    empty = cols == 0
    best, cur_start = None, None
    for x, e in enumerate(empty):
        if e and cur_start is None:
            cur_start = x
        if (not e or x == len(empty) - 1) and cur_start is not None:
            end = x if not e else x + 1
            if 0 < cur_start and end < len(empty):
                if best is None or (end - cur_start) > (best[1] - best[0]):
                    best = (cur_start, end)
            cur_start = None
    if best is None or (best[1] - best[0]) < im.width * min_gap_frac:
        return [im]
    mid = (best[0] + best[1]) // 2
    return [trim(im.crop((0, 0, mid, im.height))), trim(im.crop((mid, 0, im.width, im.height)))]


def trim(im: Image.Image, pad: int = 6) -> Image.Image:
    a = np.asarray(im.split()[-1])
    ys, xs = np.where(a > 8)
    if len(xs) == 0:
        return im
    return im.crop((max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, im.width), min(ys.max() + pad, im.height)))


@lru_cache(maxsize=None)
def sprite(key: str) -> Image.Image:
    """Named singles, split out of the pair masters where needed."""
    name, _, idx = key.partition("#")
    im = cutout(name)
    if idx == "":
        return im
    parts = split_columns(im)
    return parts[int(idx)] if int(idx) < len(parts) else im


@lru_cache(maxsize=None)
def logo() -> Image.Image:
    """The wordmark with its dark plate subtracted, so it can be added (linear dodge)
    onto the stage and keep every bit of the orbit glow."""
    src = Image.open(ROOT / "public" / "images" / "playorbit-logo.png").convert("RGB")
    arr = np.asarray(src).astype(np.float32)
    corners = np.concatenate([arr[:40, :40].reshape(-1, 3), arr[-40:, -40:].reshape(-1, 3)])
    plate = np.median(corners, axis=0)
    add = np.clip(arr - plate, 0, 255)
    im = Image.fromarray(add.astype(np.uint8), "RGB")
    lum = np.asarray(ImageOps.grayscale(im))
    ys, xs = np.where(lum > 6)
    return im.crop((xs.min() - 10, ys.min() - 10, xs.max() + 10, ys.max() + 10))


def add_logo(canvas: Image.Image, width: int, cx: float, cy: float, opacity: float) -> None:
    lg = logo()
    lg = lg.resize((width, round(lg.height * width / lg.width)), Image.LANCZOS)
    x = round(canvas.width * cx - lg.width / 2)
    y = round(canvas.height * cy - lg.height / 2)
    region = canvas.crop((x, y, x + lg.width, y + lg.height))
    base = np.asarray(region.convert("RGB")).astype(np.float32)
    out = np.clip(base + np.asarray(lg).astype(np.float32) * opacity, 0, 255).astype(np.uint8)
    canvas.paste(Image.fromarray(out, "RGB").convert("RGBA"), (x, y))


# ------------------------------------------------------------------ stage --


@lru_cache(maxsize=None)
def gradient(w: int, h: int) -> Image.Image:
    y = np.linspace(0, 1, h)[:, None]
    top, mid, bot = (np.array(c, dtype=np.float32) for c in (NAVY_TOP, NAVY_MID, NAVY_BOT))
    col = np.where(y < 0.55, top + (mid - top) * (y / 0.55), mid + (bot - mid) * ((y - 0.55) / 0.45))
    arr = np.repeat(col[:, None, :], w, axis=1)
    return Image.fromarray(arr.astype(np.uint8), "RGB")


@lru_cache(maxsize=None)
def vignette(w: int, h: int) -> Image.Image:
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dx = (xx - w / 2) / (w / 2)
    dy = (yy - h / 2) / (h / 2)
    d = np.sqrt(dx * dx + dy * dy)
    v = np.clip(1.0 - 0.55 * np.clip(d - 0.55, 0, None) ** 1.5, 0, 1)
    return Image.fromarray((v * 255).astype(np.uint8), "L")


@lru_cache(maxsize=None)
def backdrop(path: str, w: int, h: int) -> Image.Image:
    """A KIS workshop photo pushed far back: blurred, desaturated, tinted navy."""
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    im = ImageOps.fit(im, (int(w * 1.25), int(h * 1.25)), Image.LANCZOS, centering=(0.5, 0.45))
    im = im.filter(ImageFilter.GaussianBlur(max(8, w // 90)))
    grey = ImageOps.grayscale(im)
    arr = np.asarray(grey).astype(np.float32) / 255.0
    arr = arr ** 1.4 * 0.55  # crush blacks, keep it a whisper
    tint = np.array(NAVY_MID, dtype=np.float32) * 0.5 + np.array(SKY, dtype=np.float32) * 0.25
    out = np.clip(arr[..., None] * (np.array([255, 255, 255], np.float32) * 0.35 + tint * 0.65) + np.array(NAVY_TOP), 0, 255)
    return Image.fromarray(out.astype(np.uint8), "RGB")


@lru_cache(maxsize=None)
def scrim(w: int, h: int) -> Image.Image:
    """Dark gradient over the top third so headlines stay legible over bat handles."""
    y = np.linspace(0, 1, h)[:, None]
    a = np.clip(1 - y / 0.34, 0, 1) ** 1.6 * 0.86
    layer = Image.new("RGBA", (w, h), NAVY_TOP + (0,))
    layer.putalpha(Image.fromarray(np.repeat((a * 255).astype(np.uint8), w, axis=1), "L"))
    return layer


def radial_glow(w: int, h: int, cx: float, cy: float, radius: float, color, strength: float) -> Image.Image:
    small_w, small_h = max(w // 8, 8), max(h // 8, 8)
    yy, xx = np.mgrid[0:small_h, 0:small_w].astype(np.float32)
    d = np.sqrt(((xx / small_w) - cx) ** 2 * (w / h) ** 2 + ((yy / small_h) - cy) ** 2) / (radius)
    a = np.clip(1 - d, 0, 1) ** 2 * strength
    layer = Image.new("RGB", (small_w, small_h), color)
    layer.putalpha(Image.fromarray((a * 255).astype(np.uint8), "L"))
    return layer.resize((w, h), Image.BILINEAR)


GRAIN_SIGMA = float(os.environ.get("GRAIN", "2.2"))  # heavy grain is incompressible; keep it a whisper for video


@lru_cache(maxsize=None)
def grain_bank(w: int, h: int, n: int = 12) -> tuple[np.ndarray, ...]:
    rng = np.random.default_rng(7)
    return tuple(rng.normal(0, GRAIN_SIGMA, (h, w, 1)).astype(np.float32) for _ in range(n))


def apply_grain(im: Image.Image, frame_idx: int) -> Image.Image:
    bank = grain_bank(im.width, im.height)
    arr = np.asarray(im).astype(np.float32) + bank[frame_idx % len(bank)]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


# ------------------------------------------------------------ compositing --


@dataclass
class Placed:
    key: str
    cx: float  # centre, fraction of W
    cy: float  # centre, fraction of H
    height: float  # fraction of H
    rot: float = 0.0
    opacity: float = 1.0
    glow: float = 0.55
    shadow: float = 0.7
    sheen: float | None = None  # 0..1 position of a light sweep across the sprite, None = off


@lru_cache(maxsize=4096)
def transformed(key: str, height_px: int, rot_deci: int) -> Image.Image:
    im = sprite(key)
    im = im.resize((max(1, round(im.width * height_px / im.height)), height_px), Image.LANCZOS)
    if rot_deci:
        im = im.rotate(rot_deci / 10, resample=Image.BICUBIC, expand=True)
    return im


def soft_layer(alpha: Image.Image, color, blur: int, gain: float) -> Image.Image:
    """Blurred, tinted copy of an alpha mask, computed at quarter size for speed."""
    small = alpha.resize((max(alpha.width // 4, 1), max(alpha.height // 4, 1)), Image.BILINEAR)
    small = small.filter(ImageFilter.GaussianBlur(max(blur // 4, 1)))
    a = np.clip(np.asarray(small).astype(np.float32) * gain, 0, 255).astype(np.uint8)
    layer = Image.new("RGBA", small.size, color + (0,))
    layer.putalpha(Image.fromarray(a, "L"))
    return layer.resize(alpha.size, Image.BILINEAR)


def composite(canvas: Image.Image, p: Placed) -> None:
    W, H = canvas.size
    if p.opacity <= 0.01:
        return
    hp = max(8, round(p.height * H))
    im = transformed(p.key, hp, round(p.rot * 10))
    x = round(p.cx * W - im.width / 2)
    y = round(p.cy * H - im.height / 2)
    alpha = im.split()[-1]
    pad = max(40, hp // 12)
    if p.shadow > 0:
        sh = soft_layer(alpha, (0, 0, 0), pad, 1.0)
        sh = ImageOps.expand(sh, pad)
        sha = sh.split()[-1].point(lambda v: int(v * p.shadow * p.opacity))
        sh.putalpha(sha)
        canvas.alpha_composite(sh, (x - pad + round(hp * 0.02), y - pad + round(hp * 0.035)))
    if p.glow > 0:
        gl = soft_layer(alpha, SKY, pad, 1.0)
        gl = ImageOps.expand(gl, pad)
        gla = gl.split()[-1].point(lambda v: int(v * p.glow * 0.5 * p.opacity))
        gl.putalpha(gla)
        canvas.alpha_composite(gl, (x - pad, y - pad))
    body = im
    if p.sheen is not None:
        body = im.copy()
        w, h = body.size
        sx = (p.sheen * 1.6 - 0.3) * (w + h)
        xx, yy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
        band = np.exp(-((xx + yy * 0.6 - sx) ** 2) / (2 * (0.10 * (w + h)) ** 2)) * 0.32
        arr = np.asarray(body).astype(np.float32)
        arr[..., :3] = np.clip(arr[..., :3] + band[..., None] * 255, 0, 255)
        body = Image.fromarray(arr.astype(np.uint8), "RGBA")
    if p.opacity < 1:
        a = body.split()[-1].point(lambda v: int(v * p.opacity))
        body = body.copy()
        body.putalpha(a)
    canvas.alpha_composite(body, (x, y))


# ------------------------------------------------------------------- type --


@lru_cache(maxsize=None)
def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f"Geist-{weight}.ttf"), size)


def text_width(text: str, size: int, weight: str, tracking: float) -> float:
    f = font(weight, size)
    return sum(f.getlength(c) for c in text) + tracking * size * (len(text) - 1)


def fit_size(text: str, size: int, max_width: float, weight: str = "BlackItalic", tracking: float = -0.02) -> int:
    """Largest size <= `size` at which `text` fits in `max_width`."""
    while size > 12 and text_width(text, size, weight, tracking) > max_width:
        size -= 2
    return size


def draw_text(canvas: Image.Image, text: str, x: int, y: int, size: int, fill, weight: str = "Black",
              tracking: float = -0.02, anchor: str = "l", shadow: bool = True, opacity: float = 1.0) -> int:
    """Draw one line with manual tracking; returns the line width. anchor l|m|r on x."""
    f = font(weight, size)
    chars = list(text)
    widths = [f.getlength(c) for c in chars]
    total = sum(widths) + tracking * size * (len(chars) - 1)
    if anchor == "m":
        x = round(x - total / 2)
    elif anchor == "r":
        x = round(x - total)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx = float(x)
    for c, w in zip(chars, widths):
        if shadow:
            d.text((cx + size * 0.03, y + size * 0.05), c, font=f, fill=(0, 0, 0, 200))
        d.text((cx, y), c, font=f, fill=fill + (255,) if len(fill) == 3 else fill)
        cx += w + tracking * size
    if opacity < 1:
        a = layer.split()[-1].point(lambda v: int(v * opacity))
        layer.putalpha(a)
    canvas.alpha_composite(layer)
    return round(total)


def draw_pill(canvas: Image.Image, text: str, cx: int, cy: int, size: int, opacity: float = 1.0) -> None:
    f = font("Bold", size)
    w = f.getlength(text) + size * 0.14 * (len(text) - 1)
    pw, ph = round(w + size * 1.8), round(size * 2.1)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    box = (cx - pw // 2, cy - ph // 2, cx + pw // 2, cy + ph // 2)
    d.rounded_rectangle(box, radius=ph // 2, fill=SKY + (26,), outline=SKY + (70,), width=2)
    x = cx - w / 2
    for c in text:
        d.text((x, cy - size * 0.62), c, font=f, fill=SKY + (255,))
        x += f.getlength(c) + size * 0.14
    if opacity < 1:
        layer.putalpha(layer.split()[-1].point(lambda v: int(v * opacity)))
    canvas.alpha_composite(layer)


# ----------------------------------------------------------------- scenes --


@dataclass
class Layout:
    """Where things sit for a given canvas shape."""
    W: int
    H: int
    text: bool
    # subject anchor: the band leaves the left 40% to the React headline
    ax: float = 0.62
    bat_h: float = 1.45

    @property
    def portrait(self) -> bool:
        return self.H > self.W

    @property
    def square(self) -> bool:
        return self.H == self.W


def layout_for(kind: str) -> Layout:
    if kind == "band":
        return Layout(1600, 900, text=False, ax=0.63, bat_h=1.45)
    if kind == "reel":
        return Layout(1080, 1920, text=True, ax=0.5, bat_h=0.72)
    if kind == "square":
        return Layout(1080, 1080, text=True, ax=0.5, bat_h=1.05)
    if kind == "card":
        return Layout(1200, 1500, text=True, ax=0.5, bat_h=0.92)
    raise ValueError(kind)


# Scene timing (seconds). Each scene owns [start, end); crossfades overlap by XF.
XF = 0.7
SCENES = [("trio", 0.0, 4.6), ("range", 4.6, 9.4), ("detail", 9.4, 13.2), ("edge", 13.2, 17.4), ("end", 17.4, 20.0)]
DURATION = 20.0

COPY = {
    "trio": ("KASHMIR WILLOW.", "Pressed in Anantnag by Khan International Sports."),
    "range": ("THE KIS RANGE.", "Kashmir willow to English willow, Legends to Master Pro."),
    "detail": ("PICK IT UP FIRST.", "Feel the balance on two or three before you decide."),
    "edge": ("BUILT FOR LEATHER.", "Thick edges, full profiles, ready for the nets."),
    "end": ("HAND-PICK AT TOPLAY.", "playorbit.in/shop"),
}


def scene_trio(L: Layout, t: float, u: float, alpha: float, c: Image.Image) -> None:
    """u = seconds since scene start. Trio drifts; no entry so the loop is seamless."""
    drift = ease_in_out_cubic(u / 4.6)
    h = L.bat_h * lerp(1.0, 1.05, drift)
    cy = (0.60 if not L.text else 0.60) - 0.02 * drift
    c.alpha_composite(radial_glow(L.W, L.H, L.ax, cy - 0.05, 0.5, SKY, 0.16 * alpha))
    composite(c, Placed("mh7000-face", L.ax, cy, h, rot=lerp(-1.5, 1.5, drift), opacity=alpha, glow=0.7))


def scene_range(L: Layout, t: float, u: float, alpha: float, c: Image.Image) -> None:
    keys = ["classic-face#0", "legends-face#0", "am-face#0", "pro-face#1", "limited-face#0"]
    n = len(keys)
    if L.portrait:
        xs = [0.18, 0.34, 0.50, 0.66, 0.82]
        rots = [-9, -4.5, 0, 4.5, 9]
        h = L.bat_h * 0.98
        cy = 0.58
    else:
        span = 0.50 if not L.text else 0.78
        x0 = L.ax - span / 2 + (0.05 if not L.text else 0)
        xs = [x0 + span * i / (n - 1) for i in range(n)]
        rots = [-8, -4, 0, 4, 8]
        h = L.bat_h * 0.92
        cy = 0.62
    push = ease_in_out_cubic(seg(u, 1.2, 3.4))
    c.alpha_composite(radial_glow(L.W, L.H, L.ax, cy - 0.08, 0.6, SKY, 0.14 * alpha))
    for i, k in enumerate(keys):
        e = ease_out_expo(seg(u, 0.12 * i, 1.1))
        dx = (1 - e) * (0.55 if not L.portrait else 0.9)
        dy = (1 - e) * 0.05
        composite(c, Placed(k, xs[i] + dx, cy + dy, h * lerp(1.0, 1.04, push), rot=rots[i] * e, opacity=alpha * min(1, e * 3), glow=0.5))


def scene_detail(L: Layout, t: float, u: float, alpha: float, c: Image.Image) -> None:
    pan = ease_in_out_cubic(u / 3.8)
    if L.portrait:
        h, cx, cy = 0.62, 0.5, 0.52
    elif L.square:
        h, cx, cy = 1.0, 0.5, 0.62
    else:
        h, cx, cy = 1.35, lerp(L.ax + 0.05, L.ax - 0.02, pan), 0.55
    sheen = seg(u, 0.9, 1.8)
    c.alpha_composite(radial_glow(L.W, L.H, cx, cy, 0.55, SKY_LIGHT, 0.12 * alpha))
    composite(c, Placed("limited-grains", cx, cy, h * lerp(1.0, 1.06, pan), rot=lerp(2, -1, pan), opacity=alpha, glow=0.35, shadow=0.8, sheen=sheen if 0 < sheen < 1 else None))


def scene_edge(L: Layout, t: float, u: float, alpha: float, c: Image.Image) -> None:
    keys = ["reserve-edge", "reserve-face", "classic-side#0", "pads-white"]
    if L.portrait:
        pos = [(0.24, 0.56, 0.80, -10), (0.42, 0.56, 0.80, -3), (0.60, 0.56, 0.80, 4), (0.80, 0.70, 0.30, 0)]
    elif L.square:
        pos = [(0.22, 0.64, 1.05, -10), (0.40, 0.64, 1.05, -3), (0.58, 0.64, 1.05, 4), (0.82, 0.76, 0.40, 0)]
    else:
        pos = [(L.ax - 0.20, 0.62, 1.30, -10), (L.ax - 0.06, 0.62, 1.30, -3), (L.ax + 0.08, 0.62, 1.30, 4), (L.ax + 0.25, 0.75, 0.55, 0)]
    c.alpha_composite(radial_glow(L.W, L.H, L.ax, 0.5, 0.6, SKY, 0.14 * alpha))
    for i, (k, (cx, cy, h, rot)) in enumerate(zip(keys, pos)):
        e = ease_out_back(seg(u, 0.14 * i, 1.2), 0.6)
        dy = (1 - ease_out_expo(seg(u, 0.14 * i, 1.2))) * 0.6
        composite(c, Placed(k, cx, cy + dy, h * (0.9 if k == "pads-white" else 1.0), rot=rot * e, opacity=alpha * min(1, e * 2), glow=0.45))


def scene_end(L: Layout, t: float, u: float, alpha: float, c: Image.Image) -> None:
    """Logo card. In the band this simply crossfades back to the trio."""
    if not L.text:
        scene_trio(L, t, 0.0, alpha, c)
        return
    e = ease_out_expo(seg(u, 0.1, 1.2))
    lw = round(L.W * (0.66 if L.portrait else 0.46) * lerp(0.92, 1.0, e))
    cy = 0.38 if L.portrait else 0.36
    c.alpha_composite(radial_glow(L.W, L.H, 0.5, cy, 0.5, PURPLE, 0.18 * alpha * e))
    composite(c, Placed("mh7000-face", 0.5, 1.10 if L.portrait else 1.12, 0.9 if L.portrait else 0.95, opacity=alpha * 0.9 * e, glow=0.4, shadow=0.5))
    add_logo(c, lw, 0.5, cy, alpha * e)


SCENE_FN = {"trio": scene_trio, "range": scene_range, "detail": scene_detail, "edge": scene_edge, "end": scene_end}


def scene_copy(L: Layout, name: str, u: float, dur: float, alpha: float, c: Image.Image) -> None:
    head, sub = COPY[name]
    e_in = ease_out_expo(seg(u, 0.25, 0.9))
    a = alpha * e_in
    if a <= 0.01:
        return
    if L.portrait:
        size, y_head, y_sub, x, anchor = 92, round(L.H * 0.10), round(L.H * 0.10) + 112, round(L.W * 0.07), "l"
    elif L.square:
        size, y_head, y_sub, x, anchor = 74, round(L.H * 0.07), round(L.H * 0.07) + 90, round(L.W * 0.06), "l"
    else:
        size, y_head, y_sub, x, anchor = 84, round(L.H * 0.10), round(L.H * 0.10) + 100, round(L.W * 0.07), "l"
    words = head.split(" ")
    accent_word = words[-1]
    lead = " ".join(words[:-1]) + (" " if len(words) > 1 else "")
    size = fit_size(head, size, L.W - 2 * x)
    y_sub = y_head + round(size * 1.22)
    slide = round((1 - e_in) * 40)
    w = draw_text(c, lead, x, y_head + slide, size, WHITE, "BlackItalic", opacity=a)
    draw_text(c, accent_word, x + w, y_head + slide, size, SKY, "BlackItalic", opacity=a)
    e_sub = ease_out_expo(seg(u, 0.55, 0.9))
    draw_text(c, sub, x, y_sub + round((1 - e_sub) * 30), round(size * 0.36), SLATE, "Medium", tracking=0.0, shadow=True, opacity=alpha * e_sub)
    if name == "end":
        e_pill = ease_out_back(seg(u, 1.0, 0.9), 0.8)
        draw_pill(c, "KIS  ×  PLAYORBIT", L.W // 2, round(L.H * (0.56 if L.portrait else 0.62)), round(size * 0.34), opacity=alpha * clamp01(e_pill))
    else:
        draw_pill(c, "HAND-PICKED GEAR", x + round(size * 1.1), y_head - round(size * 0.55), round(size * 0.26), opacity=a)


def frame(L: Layout, t: float, idx: int) -> Image.Image:
    c = gradient(L.W, L.H).convert("RGBA")
    # backdrop: the willow stacks, drifting a touch, faint
    bd = backdrop(str(BACKDROP), L.W, L.H)
    drift = 0.5 + 0.5 * math.sin(2 * math.pi * t / DURATION)
    ox = round((bd.width - L.W) * lerp(0.35, 0.65, drift))
    oy = round((bd.height - L.H) * 0.5)
    bd_crop = bd.crop((ox, oy, ox + L.W, oy + L.H)).convert("RGBA")
    bd_crop.putalpha(Image.new("L", (L.W, L.H), 150))
    c.alpha_composite(bd_crop)
    # scenes, with crossfades
    active: list[tuple[str, float, float, float]] = []
    for name, start, end in SCENES:
        if t < start - XF or t >= end + 0.001:
            continue
        a_in = ease_in_out_cubic(seg(t, start - XF, XF)) if start > 0 else 1.0
        a_out = 1 - ease_in_out_cubic(seg(t, end - XF, XF)) if end < DURATION else 1.0
        # the band loops: fade the tail into the head
        if not L.text and end >= DURATION:
            a_out = 1 - ease_in_out_cubic(seg(t, end - XF, XF))
        alpha = min(a_in, a_out)
        if alpha <= 0.005:
            continue
        SCENE_FN[name](L, t, max(0.0, t - start), alpha, c)
        active.append((name, start, end, alpha))
    if not L.text and t >= DURATION - XF:  # loop seam: head of the trio scene fades back in
        a = ease_in_out_cubic(seg(t, DURATION - XF, XF))
        scene_trio(L, 0.0, 0.0, a, c)
    if L.text:
        c.alpha_composite(scrim(L.W, L.H))
        for name, start, end, alpha in active:
            scene_copy(L, name, max(0.0, t - start), end - start, alpha, c)
    # vignette + grain
    rgb = c.convert("RGB")
    dark = Image.new("RGB", (L.W, L.H), NAVY_TOP)
    rgb = Image.composite(rgb, dark, vignette(L.W, L.H))
    return apply_grain(rgb, idx)


# ----------------------------------------------------------------- driver --

_L: Layout | None = None


def _init(kind: str) -> None:
    global _L
    _L = layout_for(kind)
    # warm caches once per worker
    gradient(_L.W, _L.H)
    vignette(_L.W, _L.H)
    backdrop(str(BACKDROP), _L.W, _L.H)


def _render(idx: int) -> bytes:
    assert _L is not None
    return frame(_L, idx / FPS, idx).tobytes()


def render_video(kind: str, out: Path, crf: int = 22) -> None:
    L = layout_for(kind)
    n = int(DURATION * FPS)
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{L.W}x{L.H}", "-r", str(FPS), "-i", "-",
        "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1",
        "-movflags", "+faststart", "-an", str(out),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    workers = max(2, (os.cpu_count() or 4) - 2)
    with Pool(workers, initializer=_init, initargs=(kind,)) as pool:
        for i, data in enumerate(pool.imap(_render, range(n), chunksize=4)):
            proc.stdin.write(data)
            if i % 60 == 0:
                print(f"  {kind}: {i}/{n}", flush=True)
    proc.stdin.close()
    proc.wait()
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")


def render_preview(kind: str) -> None:
    L = layout_for(kind)
    _init(kind)
    times = [0.4, 2.5, 5.6, 8.0, 11.0, 14.6, 16.0, 18.8]
    tiles = [frame(L, t, i) for i, t in enumerate(times)]
    tw = 480 if not L.portrait else 270
    th = round(tw * L.H / L.W)
    cols = 4
    sheet = Image.new("RGB", (cols * tw, ((len(tiles) + cols - 1) // cols) * th), "black")
    for i, im in enumerate(tiles):
        sheet.paste(im.resize((tw, th), Image.LANCZOS), ((i % cols) * tw, (i // cols) * th))
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    p = PREVIEW_DIR / f"preview-{kind}.jpg"
    sheet.save(p, quality=88)
    print("preview", p)


def render_stills() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # band poster = the trio at rest
    L = layout_for("band")
    _init("band")
    frame(L, 0.2, 3).save(OUT / "kis-gear-band.jpg", quality=86, optimize=True, progressive=True)
    # 4:5 cards for Instagram / WhatsApp, one per scene
    L = layout_for("card")
    _init("card")
    for name, start, end in SCENES:
        t = start + (end - start) * 0.72
        im = frame(L, t, 5)
        im.save(OUT / f"card-{name}.jpg", quality=90, optimize=True)
    print("stills written to", OUT)


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)
    kind = args[0]
    if kind == "stills":
        render_stills()
    elif "--preview" in args:
        render_preview(kind)
    else:
        name = {"band": "kis-hero.mp4", "reel": "kis-reel-9x16.mp4", "square": "kis-feed-1x1.mp4"}[kind]
        render_video(kind, OUT / name, crf=27 if kind == "band" else 22)
