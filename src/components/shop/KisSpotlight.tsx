'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MapPin, Sparkles } from 'lucide-react';
import { SHOP_PATH, type MarketplaceProductView } from '@/lib/marketplace';
import { KIS_HERO_PHOTOS, KIS_MODEL } from '@/lib/kis-showcase';
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion';
import { KisFrame } from './KisFrame';
import { ComingSoonBadge, PriceTag, StockPill } from './ShopBadges';

/** How long each frame holds before the cross-fade. */
const FRAME_MS = 5200;
/** How many frames past the current one are kept in the DOM. */
const LOOKAHEAD = 2;

interface KisSpotlightProps {
  /** Where the call to action goes — the product page once the catalog is loaded. */
  href?: string;
  /**
   * The catalog row for the bat, when it is loaded. Price and stock are
   * read from it rather than written into the copy, so the spotlight can
   * never disagree with the product page after a price edit.
   */
  product?: MarketplaceProductView | null;
  comingSoon?: boolean;
  /** The store's "hand-pick and collect at…" line, if it has one. */
  pickupNote?: string;
  /** True only for the topmost spotlight on a page — it owns the LCP image. */
  priority?: boolean;
  className?: string;
}

/**
 * The single-model showcase: one bat, shown big.
 *
 * The store stocks exactly one bat, so the usual storefront shape — a
 * grid of tiles with one lonely card in it — reads as three products
 * missing rather than one product chosen. This puts the photography at
 * hero scale instead and lets the catalog row supply the facts.
 *
 * The plate cross-fades through the shoot. Frames mount lazily (the
 * current one plus `LOOKAHEAD`), so arriving at the page costs two
 * photos rather than five, and the rotation stops entirely while the
 * tab is in the background — a 5-second timer on a hidden tab is pure
 * battery. With reduced motion on, the first frame simply stays put and
 * the dots still work.
 */
export function KisSpotlight({
  href,
  product,
  comingSoon = false,
  pickupNote = '',
  priority = false,
  className = '',
}: KisSpotlightProps) {
  const reducedMotion = usePrefersReducedMotion();
  const photos = KIS_HERO_PHOTOS;
  const count = photos.length;
  const target = href ?? SHOP_PATH;

  // One piece of state, so advancing can never leave the active frame
  // unmounted: `mounted` is how many leading frames are in the DOM.
  const [{ index, mounted }, setFrame] = useState({ index: 0, mounted: Math.min(count, 1 + LOOKAHEAD) });

  const goTo = (next: number) =>
    setFrame((prev) => ({
      index: next,
      mounted: Math.max(prev.mounted, Math.min(count, next + 1 + LOOKAHEAD)),
    }));

  useEffect(() => {
    if (reducedMotion || count < 2) return;
    let timer = 0;
    const tick = () => setFrame((p) => ({
      index: (p.index + 1) % count,
      mounted: Math.max(p.mounted, Math.min(count, ((p.index + 1) % count) + 1 + LOOKAHEAD)),
    }));
    const start = () => {
      window.clearInterval(timer);
      timer = window.setInterval(tick, FRAME_MS);
    };
    const onVisibility = () => (document.hidden ? window.clearInterval(timer) : start());
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reducedMotion, count]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.07] bg-[#050b14] ${className}`}
    >
      {/* Ambient wash — keeps the plate from reading as a photo pasted on black. */}
      <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full bg-accent/10 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-28 -left-24 w-72 h-72 rounded-full bg-purple-500/[0.09] blur-[90px]" />

      <div className="relative grid md:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] md:items-center">
        {/* ── The plate ───────────────────────────────────────── */}
        <div className="order-1 md:order-2 p-3 md:p-6">
          <div className="relative mx-auto w-full max-w-[300px] md:max-w-[380px] aspect-[4/5] rounded-xl md:rounded-2xl overflow-hidden bg-[#050b14] ring-1 ring-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            {photos.slice(0, mounted).map((photo, i) => (
              <div
                key={photo.slug}
                className={`absolute inset-0 transition-opacity duration-1000 ease-out ${
                  i === index ? 'opacity-100' : 'opacity-0'
                }`}
                aria-hidden={i === index ? undefined : true}
              >
                <KisFrame
                  photo={photo}
                  sizes="(max-width: 768px) 300px, 380px"
                  priority={priority && i === 0}
                  className={reducedMotion ? '' : 'kis-drift'}
                />
              </div>
            ))}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#020509] to-transparent" />

            {count > 1 && (
              <div
                className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5"
                role="tablist"
                aria-label={`${KIS_MODEL.fullName} photos`}
              >
                {photos.map((photo, i) => (
                  <button
                    key={photo.slug}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Photo ${i + 1} of ${count}`}
                    onClick={() => goTo(i)}
                    // 28px of tappable area around a 6px dot — the dot
                    // itself is well under the 44px touch-target floor.
                    className="p-2.5 -m-1 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span
                      className={`block w-1.5 h-1.5 rounded-full transition-all ${
                        i === index ? 'bg-accent w-5' : 'bg-white/40 hover:bg-white/70'
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── The facts ───────────────────────────────────────── */}
        <div className="order-2 md:order-1 px-4 pb-5 md:p-9 md:pr-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/20 px-2.5 py-1 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            <Sparkles className="w-2.5 h-2.5 md:w-3 md:h-3" />
            {KIS_MODEL.eyebrow}
          </span>

          <p className="mt-3 text-[10px] md:text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">
            {KIS_MODEL.brand} &middot; {KIS_MODEL.origin}
          </p>
          <h3 className="text-3xl md:text-5xl font-black italic tracking-tighter text-white leading-none mt-1">
            {KIS_MODEL.model}
          </h3>

          <div className="mt-3 flex items-center gap-2.5 flex-wrap">
            {product ? <PriceTag product={product} size="lg" /> : null}
            {comingSoon ? <ComingSoonBadge size="lg" /> : product ? <StockPill product={product} /> : null}
          </div>

          <p className="mt-3 text-xs md:text-sm text-slate-400 leading-relaxed max-w-md">{KIS_MODEL.blurb}</p>

          <ul className="mt-3.5 flex flex-wrap gap-1.5">
            {KIS_MODEL.claims.map((claim) => (
              <li
                key={claim}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] md:text-[11px] font-semibold text-slate-300"
              >
                {claim}
              </li>
            ))}
          </ul>

          <Link
            href={target}
            className="mt-4 md:mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-accent hover:bg-accent-light text-primary font-black px-5 py-2.5 text-xs md:text-sm transition-all hover:shadow-[0_0_40px_rgba(56,189,248,0.35)] active:scale-[0.98]"
          >
            SEE THE BAT
            <ArrowRight className="w-4 h-4" />
          </Link>

          {pickupNote && (
            <p className="mt-3 flex items-start gap-1.5 text-[11px] md:text-xs text-slate-500 leading-snug">
              <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-accent/70" aria-hidden="true" />
              {pickupNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
