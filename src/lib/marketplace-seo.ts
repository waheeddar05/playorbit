/**
 * Share cards for the Cricket Store — what WhatsApp, Instagram and the
 * search engines show for /shop and a product link.
 *
 * The store is marketed over WhatsApp: a product link is pasted into a
 * chat, and the preview card under it is the first thing anyone sees.
 * Without this every store link rendered the generic PlayOrbit cover
 * ("Book cricket practice in Pune") — no bat, no price.
 *
 * Pure module: no Prisma, no React, so the route can call it from
 * `generateMetadata` and a test can pin the exact copy. The image is
 * a static file (`/images/og-store.jpg`, rendered by
 * scripts/kis-creatives/render-og-card.py) because WhatsApp caches the
 * preview for days; everything that changes in the admin panel — price,
 * pre-booking state — rides in the title and description instead.
 */

import type { Metadata } from 'next';
import { KIS_MODEL, isKisModel } from './kis-showcase';
import { SHOP_PATH, STORE_NAME, formatRupees, type MarketplaceProductView } from './marketplace';

/** The 1200×630 card. Static under /images so the middleware never intercepts a crawler's fetch. */
export const STORE_SHARE_IMAGE = {
  url: '/images/og-store.jpg',
  width: 1200,
  height: 630,
  alt: `${KIS_MODEL.fullName} Kashmir willow cricket bat — the PlayOrbit ${STORE_NAME}`,
} as const;

export const STORE_TITLE = `${KIS_MODEL.fullName} — PlayOrbit ${STORE_NAME}`;

export const STORE_DESCRIPTION =
  `One bat, picked in person: the ${KIS_MODEL.fullName} in ${KIS_MODEL.claims[0]}, ` +
  `knocked in ready and hand-finished in ${KIS_MODEL.origin}. Pre-book or order from PlayOrbit.`;

/** Longest description a WhatsApp / Google preview shows in full. */
const DESCRIPTION_MAX = 200;

/** `/shop` — the storefront itself. */
export function storeMetadata(): Metadata {
  return {
    title: STORE_TITLE,
    description: STORE_DESCRIPTION,
    alternates: { canonical: SHOP_PATH },
    openGraph: {
      title: STORE_TITLE,
      description: STORE_DESCRIPTION,
      type: 'website',
      siteName: 'PlayOrbit',
      locale: 'en_IN',
      url: SHOP_PATH,
      images: [STORE_SHARE_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: STORE_TITLE,
      description: STORE_DESCRIPTION,
      images: [STORE_SHARE_IMAGE.url],
    },
  };
}

export type ShareableProduct = Pick<
  MarketplaceProductView,
  'id' | 'name' | 'brand' | 'price' | 'mrp' | 'description' | 'primaryImage'
>;

export interface ProductShareInput {
  product: ShareableProduct;
  /** Store-wide pre-launch state — decides the opening line. */
  comingSoon: boolean;
}

/** "KIS M&H 7000 — ₹6,500 | Cricket Store" */
export function productShareTitle(product: Pick<ShareableProduct, 'name' | 'price'>): string {
  return `${product.name} — ${formatRupees(product.price)} | PlayOrbit ${STORE_NAME}`;
}

/**
 * The state line, then the first paragraph of the product's own
 * description, cut at a word so a preview never ends mid-word.
 */
export function productShareDescription({ product, comingSoon }: ProductShareInput): string {
  const state = comingSoon
    ? 'Pre-booking open — nothing to pay now.'
    : `Order from the PlayOrbit ${STORE_NAME}.`;
  const firstParagraph = (product.description ?? '')
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, ' ')
    .trim();
  if (!firstParagraph) return state;
  const room = DESCRIPTION_MAX - state.length - 1;
  return `${state} ${truncateAtWord(firstParagraph, room)}`;
}

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, Math.max(0, max - 1));
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.]+$/, '')}…`;
}

/**
 * `/shop/[id]` — one product.
 *
 * The M&H 7000 gets the store card: that image *is* this bat, sized and
 * compressed for WhatsApp. Any other product uses its own primary photo
 * (served from /api/shop/images, public), and falls back to the store
 * card when it has none.
 */
export function productMetadata(input: ProductShareInput): Metadata {
  const { product } = input;
  const title = productShareTitle(product);
  const description = productShareDescription(input);
  const path = `${SHOP_PATH}/${encodeURIComponent(product.id)}`;
  const ownPhoto = !isKisModel(product) && product.primaryImage ? product.primaryImage : null;
  const image = ownPhoto
    ? {
        url: ownPhoto.url,
        ...(ownPhoto.width && ownPhoto.height ? { width: ownPhoto.width, height: ownPhoto.height } : {}),
        alt: product.name,
      }
    : STORE_SHARE_IMAGE;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'PlayOrbit',
      locale: 'en_IN',
      url: path,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image.url],
    },
  };
}
