#!/usr/bin/env python3
"""
Pull every full-size KIS product photo the reseller publishes.

made-in-kashmir.com is a Shopify store whose KIS listings carry vendor
"Khan International Sports"; its /products.json exposes the original
uploads (3000-6000 px), far better than the 1280 px listing renditions.
KIS has agreed to PlayOrbit using its material; we only ever re-stage it.

    python3 scripts/kis-creatives/fetch-masters.py            # -> kis-inbox/hires/<handle>/<file>
    python3 scripts/kis-creatives/fetch-masters.py --list     # just print what would be fetched

Stdlib only. Skips files already present, so it is safe to re-run.
"""
from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "kis-inbox" / "hires"
STORE = "https://made-in-kashmir.com"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36"


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def kis_products() -> list[dict]:
    found: dict[str, dict] = {}
    page = 1
    while True:
        data = json.loads(get(f"{STORE}/products.json?limit=250&page={page}"))
        products = data.get("products", [])
        if not products:
            break
        for p in products:
            vendor = (p.get("vendor") or "").lower()
            title = (p.get("title") or "").lower()
            if "khan" in vendor or "kis" in vendor or " kis" in title or "kis " in title:
                found[p["handle"]] = p
        page += 1
    return list(found.values())


def main(argv: list[str]) -> None:
    listing = "--list" in argv
    seen: set[str] = set()
    ok = skipped = failed = 0
    for p in kis_products():
        for im in p.get("images", []):
            src = im["src"]
            fn = Path(urllib.parse.urlparse(src).path).name
            if fn in seen:
                continue
            seen.add(fn)
            dst = OUT / p["handle"] / fn
            if listing:
                print(f"{im['width']}x{im['height']}\t{p['handle']}\t{fn}")
                continue
            if dst.exists() and dst.stat().st_size > 0:
                skipped += 1
                continue
            dst.parent.mkdir(parents=True, exist_ok=True)
            try:
                dst.write_bytes(get(src))
                ok += 1
                print(f"ok   {p['handle']}/{fn}")
            except Exception as exc:  # noqa: BLE001 - report and carry on
                failed += 1
                print(f"FAIL {src}: {exc}", file=sys.stderr)
    if not listing:
        print(f"done: {ok} fetched, {skipped} already present, {failed} failed -> {OUT}")


if __name__ == "__main__":
    main(sys.argv[1:])
