#!/usr/bin/env python3
"""
Turn the KIS M&H 7000 shoot into the site's showcase assets.

The store sells one bat, so the same eight frames carry the landing page,
/shop and the product page. Rather than hand-maintaining eight <Image>
calls, this script writes both halves of the contract at once:

    public/images/kis/<slug>.webp   the photo, WebP q84 at native size
    src/lib/kis-photos.ts           slug, intrinsic w/h, alt, focal point,
                                    and a 14px LQIP as a data URL

The LQIP matters: these are dark mountain photographs, and without a
placeholder every one of them pops in from a black rectangle on a slow
connection. Fourteen pixels of the photo's own colour costs under a
kilobyte inside the JS bundle and removes the flash entirely.

Masters live in kis-inbox/showcase/<slug>.png (gitignored — they are
~2.5 MB each). Add a frame by dropping it there and adding a SHOTS row.

    python3 scripts/kis-creatives/prep-showcase-photos.py

Requires Pillow. Safe to re-run; it overwrites its own output.
"""
from __future__ import annotations

import base64
import io
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - operator tooling
    sys.exit("Pillow is required: pip install Pillow")

APP = Path(__file__).resolve().parents[2]
SRC = APP / "kis-inbox" / "showcase"
IMG_OUT = APP / "public" / "images" / "kis"
TS_OUT = APP / "src" / "lib" / "kis-photos.ts"

WEBP_QUALITY = 84
LQIP_WIDTH = 14

# slug, alt text, CSS object-position. The focal point is what keeps the
# bat face in frame when a 4:5 photograph is cropped into a 16:9 band.
SHOTS: list[tuple[str, str, str]] = [
    ("snow", "Three KIS M&H 7000 Kashmir willow bats standing in fresh snow below the Anantnag mountains", "50% 42%"),
    ("trio", "Three KIS M&H 7000 bats in the full-colour decal at the KIS workshop", "50% 45%"),
    ("gloves", "A KIS M&H 7000 in the blue decal with matching KIS batting gloves, shot outdoors in Kashmir", "55% 45%"),
    ("logs", "Four KIS M&H 7000 bats with green and blue grips lined up against a stack of willow logs", "50% 45%"),
    ("kitbag", "A KIS M&H 7000 beside the KIS Unstoppable kit bag on a willow stump", "42% 45%"),
    ("pair", "A pair of KIS M&H 7000 bats with teal grips, face on, at the willow yard", "50% 45%"),
    ("blade", "The full blade of a KIS M&H 7000 in the blue decal, flat against stacked willow", "50% 50%"),
    ("showroom", "A KIS M&H 7000 held up outside the KIS Unstoppable showroom in Anantnag", "50% 55%"),
]

HEADER = """// GENERATED FILE — do not edit by hand.
// Written by scripts/kis-creatives/prep-showcase-photos.py from the
// masters in kis-inbox/showcase/. Re-run that script after changing the
// shoot; every surface that shows the M&H 7000 reads this one list.

/** One frame of the M&H 7000 shoot. */
export interface KisPhoto {
  /** Stable id — also the file name under /images/kis/. */
  slug: string;
  /** Public path of the WebP. */
  src: string;
  /** Intrinsic size, so `next/image` reserves the right box. */
  width: number;
  height: number;
  alt: string;
  /** CSS object-position that keeps the bat in frame under a hard crop. */
  focal: string;
  /** 14px LQIP, for `placeholder="blur"`. */
  blurDataURL: string;
}

export const KIS_PHOTOS: readonly KisPhoto[] = [
"""


def escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("'", "\\'")


def main() -> int:
    if not SRC.is_dir():
        sys.exit(f"No masters at {SRC} — drop the shoot there first.")

    IMG_OUT.mkdir(parents=True, exist_ok=True)
    rows: list[str] = []
    total = 0

    for slug, alt, focal in SHOTS:
        master = next((p for p in sorted(SRC.glob(f"{slug}.*")) if p.suffix.lower() in
                       {".png", ".jpg", ".jpeg", ".webp"}), None)
        if master is None:
            sys.exit(f"Missing master for '{slug}' in {SRC}")

        with Image.open(master) as raw:
            im = raw.convert("RGB")
            width, height = im.size
            dest = IMG_OUT / f"{slug}.webp"
            im.save(dest, "WEBP", quality=WEBP_QUALITY, method=6)

            tiny = im.resize((LQIP_WIDTH, max(1, round(LQIP_WIDTH * height / width))), Image.LANCZOS)

        buf = io.BytesIO()
        tiny.save(buf, "JPEG", quality=40)
        lqip = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

        size = dest.stat().st_size
        total += size
        print(f"  {slug:<9} {width}x{height}  {size // 1024:>4} KB")

        rows.append(
            "  {\n"
            f"    slug: '{slug}',\n"
            f"    src: '/images/kis/{slug}.webp',\n"
            f"    width: {width},\n"
            f"    height: {height},\n"
            f"    alt: '{escape(alt)}',\n"
            f"    focal: '{focal}',\n"
            f"    blurDataURL:\n      '{lqip}',\n"
            "  },"
        )

    TS_OUT.write_text(HEADER + "\n".join(rows) + "\n];\n", encoding="utf-8")
    print(f"\n  {len(SHOTS)} photos, {total // 1024} KB -> {IMG_OUT}")
    print(f"  manifest -> {TS_OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
