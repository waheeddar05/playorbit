import type { Metadata } from 'next';
import { ProductDetailClient } from '@/components/shop/ProductDetailClient';
import { prisma } from '@/lib/prisma';
import { PRODUCT_SELECT, getMarketplaceConfig, toProductView } from '@/lib/marketplace-server';
import { productMetadata, storeMetadata } from '@/lib/marketplace-seo';

type Params = { id: string };

/**
 * The share card for one product — name, live price and the launch
 * state in the title and description, the bat in the image — so a link
 * pasted into a WhatsApp chat sells the thing before anyone taps it.
 *
 * Read straight from Prisma rather than through the API: this runs on
 * the server for the crawler's fetch as much as for a person's, and a
 * fetch back to our own origin would go through the middleware. An
 * unpublished or unknown product (or a store that is switched off)
 * gets the store's own card, which is also what a failed read gets —
 * a share preview must never turn into a 500.
 */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const [row, config] = await Promise.all([
      prisma.marketplaceProduct.findUnique({ where: { id }, select: PRODUCT_SELECT }),
      getMarketplaceConfig(),
    ]);
    if (!row || !row.isActive || !config.enabled) return storeMetadata();
    return productMetadata({ product: toProductView(row), comingSoon: config.comingSoon });
  } catch {
    return storeMetadata();
  }
}

/**
 * /shop/[id] — one product. Public: a link shared on WhatsApp must open
 * for whoever taps it, so the product is looked up by id alone and the
 * client decides what to offer (pre-book / order / sign in) from the
 * API's `signedIn` flag rather than from any session hook.
 */
export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  return <ProductDetailClient id={id} />;
}
