'use client';

import Link from 'next/link';
import { ChevronRight, ShoppingBag } from 'lucide-react';
import { SHOP_PATH, STORE_NAME } from '@/lib/marketplace';
import { useMarketplaceStatus } from '@/lib/marketplace-status';
import { KIS_MODEL, KIS_PROMO_PHOTO, isKisModel } from '@/lib/kis-showcase';
import { KisFrame } from './KisFrame';
import { OpenBadge, PreBookBadge, PriceTag } from './ShopBadges';

/**
 * The store's standing entry on the booking screen.
 *
 * /slots is the page every signed-in player lands on, so it is the one
 * place a store highlight is guaranteed to be seen. It used to be a
 * dismissible strip whose dismissal was kept in localStorage for good:
 * a player who closed it on day one never saw the store from here
 * again, which is the opposite of what a launch wants. It is now a
 * fixture — always on while the store is enabled, never closable — and
 * carries enough to be worth a look: the bat itself, the live price off
 * the catalog row, and whether the store is taking pre-bookings or
 * orders. The whole card is the link.
 *
 * It renders while the status is still loading (static copy, no price)
 * so it never pops in and shoves the booking form down a beat after
 * paint. Only a store that is switched off removes it.
 */
export function MarketplacePromoBanner() {
  const { status, loading, enabled, comingSoon } = useMarketplaceStatus();

  if (!loading && !enabled) return null;

  const featured = status?.featured ?? [];
  // The catalog is one bat deep at launch; prefer that row, fall back to
  // whatever is featured so a future catalog still gets a live price.
  const bat = featured.find(isKisModel) ?? featured[0] ?? null;
  const href = bat ? `${SHOP_PATH}/${bat.id}` : SHOP_PATH;
  // Only mark the state once we know it — the optimistic default would
  // flash "Pre-book" on a live store for a beat and then swap it.
  const known = !loading;
  const cta = known && !comingSoon ? 'Shop' : 'Pre-book';

  return (
    <Link
      href={href}
      className="group relative z-10 mb-4 flex items-center gap-3 rounded-xl border border-white/[0.08] hover:border-accent/30 bg-[#060d1b]/80 backdrop-blur-sm px-2.5 py-2 md:px-3 md:py-2.5 overflow-hidden transition-all duration-300 hover:shadow-[0_8px_40px_rgba(56,189,248,0.10)] active:scale-[0.99] animate-fade-in"
    >
      {/* Ambient wash so the card reads as part of the store, not a form row. */}
      <span className="pointer-events-none absolute -top-10 -right-6 w-32 h-32 rounded-full bg-accent/10 blur-[50px]" />

      {/* The bat, not a shopping-bag glyph: this is the cheapest place on
          the site to actually show what is for sale. */}
      {KIS_PROMO_PHOTO ? (
        <span className="relative shrink-0 w-11 h-14 md:w-12 md:h-[60px] rounded-lg overflow-hidden ring-1 ring-white/10 bg-[#050b14]">
          <KisFrame
            photo={KIS_PROMO_PHOTO}
            sizes="48px"
            className="transition-transform duration-700 group-hover:scale-110"
          />
        </span>
      ) : (
        <span className="shrink-0 w-11 h-14 rounded-lg bg-accent/10 flex items-center justify-center">
          <ShoppingBag className="w-5 h-5 text-accent" />
        </span>
      )}

      <div className="relative min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
          <ShoppingBag className="w-3 h-3" aria-hidden="true" />
          {STORE_NAME}
        </p>
        <p className="text-sm md:text-base font-black text-white leading-tight truncate mt-0.5">
          {KIS_MODEL.fullName}
          <span className="hidden sm:inline font-semibold text-slate-400"> · {KIS_MODEL.claims[0]}</span>
        </p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {bat ? <PriceTag product={bat} /> : null}
          {known ? comingSoon ? <PreBookBadge /> : <OpenBadge /> : null}
        </div>
      </div>

      <span
        className={`relative shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] md:text-xs font-bold transition-colors ${
          known && !comingSoon
            ? 'bg-accent text-primary group-hover:bg-accent-light'
            : 'bg-amber-500/15 border border-amber-500/30 text-amber-300 group-hover:bg-amber-500/25'
        }`}
      >
        {cta}
        <ChevronRight className="w-3.5 h-3.5" />
      </span>
    </Link>
  );
}
