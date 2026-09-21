import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoadingState } from '@/components/ui/LoadingState';
import { ShopPageClient } from '@/components/shop/ShopPageClient';
import { storeMetadata } from '@/lib/marketplace-seo';

/**
 * The share card for /shop: a link pasted into WhatsApp shows the bat,
 * not the generic "book cricket practice" cover. Static copy only — the
 * price and the launch state live on the product page's card, which is
 * generated per request.
 */
export const metadata: Metadata = storeMetadata();

/**
 * /shop — the public storefront.
 *
 * Browsable signed-out (the middleware lets /shop and /api/shop through),
 * so this shell stays a static server component. The catalog, filters and
 * search live in `ShopPageClient`, which reads `?category=` / `?q=` via
 * `useSearchParams` and therefore needs a Suspense boundary so the page
 * can still prerender a fallback.
 */
export default function ShopPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading the shop…" />}>
      <ShopPageClient />
    </Suspense>
  );
}
