'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SHOP_PATH } from '@/lib/marketplace';
import { useMarketplaceStatus } from '@/lib/marketplace-status';
import { KIS_MODEL } from '@/lib/kis-showcase';
import { KisSpotlight } from './KisSpotlight';
import { SHOP_BAND, ShopMediaBand } from './ShopMediaBand';

const DEFAULT_TAGLINE = 'Grade A++ Kashmir willow, knocked in ready, hand-picked at Toplay.';

/**
 * The landing page's store section.
 *
 * The store stocks one bat, so this is a campaign for that bat rather
 * than a storefront preview: the wide video band, then the spotlight
 * with the live price off the catalog row, then the way in.
 *
 * It used to show a four-up teaser of BAT / GLOVES / THIGH GUARD / PADS
 * next to a single 240px product card. That advertised three categories
 * with nothing behind them and made the one thing actually for sale the
 * smallest element on screen — exactly backwards for a one-model launch.
 *
 * While the status is loading the spotlight still renders, with no price
 * and no stock pill, so there is no empty gap and no flash of a "coming
 * soon" badge on a live store. A center with the store switched off
 * renders nothing at all.
 */
export function LandingShopSection() {
  const { status, loading, enabled, comingSoon } = useMarketplaceStatus();

  if (!loading && !enabled) return null;

  // Only mark "coming soon" once we know — the optimistic default would
  // flash the badge on a live store for a beat and then pull it.
  const showComingSoon = !loading && comingSoon;
  const featured = status?.featured ?? [];
  // The catalog is one bat deep at launch; the first featured row is it.
  const hero = featured[0] ?? null;
  const productCount = status?.productCount ?? 0;
  const tagline = (status?.launchNote ?? '').trim() || DEFAULT_TAGLINE;

  return (
    <section id="shop" className="relative z-10 px-4 md:px-6 py-4 md:py-10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-3 md:mb-8">
          <h3 className="text-lg md:text-3xl font-black text-white leading-tight">
            {KIS_MODEL.headline}{' '}
            <span className="text-shimmer">{KIS_MODEL.headlineAccent}</span>
          </h3>
          <p className="text-slate-500 text-[10px] md:text-sm mt-1 md:mt-2">{tagline}</p>
        </div>

        <ShopMediaBand {...SHOP_BAND} />

        <KisSpotlight
          href={hero ? `${SHOP_PATH}/${hero.id}` : SHOP_PATH}
          product={hero}
          comingSoon={showComingSoon}
          pickupNote={status?.pickupNote ?? ''}
        />

        {/* The catalog size rides inside the button as a count pill. As a
            separate line under it on phones it read as a stray caption. */}
        <div className="mt-3 md:mt-6 flex items-center justify-center">
          <Link
            href={SHOP_PATH}
            className="inline-flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] text-white font-bold rounded-xl px-5 py-2.5 text-xs md:text-sm transition-all active:scale-[0.98] border border-white/[0.08]"
          >
            EXPLORE THE STORE
            {productCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] md:text-[11px] font-black tabular-nums">
                {productCount} {productCount === 1 ? 'product' : 'products'}
              </span>
            )}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
