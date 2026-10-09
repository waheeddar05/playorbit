import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  STORE_DESCRIPTION,
  STORE_SHARE_IMAGE,
  STORE_TITLE,
  productMetadata,
  productShareDescription,
  productShareTitle,
  storeMetadata,
} from '@/lib/marketplace-seo';
import { KIS_MODEL } from '@/lib/kis-showcase';
import type { MarketplaceImageMeta } from '@/lib/marketplace';

const image: MarketplaceImageMeta = {
  id: 'img_1',
  url: '/api/shop/images/img_1',
  alt: null,
  width: 1200,
  height: 1500,
  sortOrder: 0,
};

const kis = {
  id: 'prod_kis',
  name: 'KIS M&H 7000',
  brand: 'KIS',
  price: 6500,
  mrp: null,
  description:
    'Grade A++ Kashmir willow from KIS’s premium press, hand-finished and knocked in ready. A serious club bat at a Kashmir-willow price.\n\nKnocked in ready matters more than it sounds.',
  primaryImage: image,
};

const gloves = {
  id: 'prod_gloves',
  name: 'KIS Pro Gloves',
  brand: 'KIS',
  price: 1800,
  mrp: 2200,
  description: null,
  primaryImage: image,
};

describe('the store card', () => {
  it('ships as a real 1200×630 file under /images, small enough for a WhatsApp preview', () => {
    const file = path.resolve(__dirname, '../../../public', STORE_SHARE_IMAGE.url.replace(/^\//, ''));
    expect(existsSync(file), file).toBe(true);
    // WhatsApp silently drops preview images above roughly 300 KB.
    expect(statSync(file).size).toBeLessThan(300 * 1024);
    expect(STORE_SHARE_IMAGE.width).toBe(1200);
    expect(STORE_SHARE_IMAGE.height).toBe(630);
  });

  it('names the bat, not the booking product', () => {
    expect(STORE_TITLE).toContain(KIS_MODEL.fullName);
    expect(STORE_DESCRIPTION).toContain(KIS_MODEL.fullName);
    expect(STORE_DESCRIPTION).toContain(KIS_MODEL.origin);
    expect(STORE_DESCRIPTION).not.toMatch(/bowling machine/i);
  });

  it('storeMetadata points every card field at /shop and the store image', () => {
    const meta = storeMetadata();
    expect(meta.title).toBe(STORE_TITLE);
    expect(meta.alternates?.canonical).toBe('/shop');
    const og = meta.openGraph as { url?: string; images?: unknown[]; siteName?: string };
    expect(og.url).toBe('/shop');
    expect(og.siteName).toBe('PlayOrbit');
    expect(og.images).toEqual([STORE_SHARE_IMAGE]);
    const tw = meta.twitter as { card?: string; images?: string[] };
    expect(tw.card).toBe('summary_large_image');
    expect(tw.images).toEqual([STORE_SHARE_IMAGE.url]);
  });
});

describe('productShareTitle', () => {
  it('carries the live price so a price edit never leaves a stale card', () => {
    expect(productShareTitle(kis)).toBe('KIS M&H 7000 — ₹6,500 | PlayOrbit Cricket Store');
    expect(productShareTitle({ ...kis, price: 5999 })).toContain('₹5,999');
  });
});

describe('productShareDescription', () => {
  it('leads with the pre-booking state and then the first paragraph only', () => {
    const text = productShareDescription({ product: kis, comingSoon: true });
    expect(text.startsWith('Pre-booking open — nothing to pay now. Grade A++')).toBe(true);
    expect(text).not.toContain('matters more than it sounds');
  });

  it('says "order" once the store is live', () => {
    const text = productShareDescription({ product: kis, comingSoon: false });
    expect(text.startsWith('Order from the PlayOrbit Cricket Store.')).toBe(true);
  });

  it('is just the state line for a product with no description', () => {
    expect(productShareDescription({ product: gloves, comingSoon: true })).toBe(
      'Pre-booking open — nothing to pay now.',
    );
  });

  it('never runs past 200 characters and never ends mid-word', () => {
    const long = { ...kis, description: Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ') };
    const text = productShareDescription({ product: long, comingSoon: true });
    expect(text.length).toBeLessThanOrEqual(200);
    expect(text.endsWith('…')).toBe(true);
    // The cut lands on a whole token, e.g. "word23…", never "wor…".
    const tail = text.slice(0, -1).split(' ').pop();
    expect(tail).toMatch(/^word\d+$/);
  });
});

describe('productMetadata', () => {
  it('gives the M&H 7000 the store card even though it has its own photo', () => {
    const meta = productMetadata({ product: kis, comingSoon: true });
    const og = meta.openGraph as { url?: string; images?: Array<{ url: string }> };
    expect(og.url).toBe('/shop/prod_kis');
    expect(og.images?.[0]).toEqual(STORE_SHARE_IMAGE);
    expect(meta.alternates?.canonical).toBe('/shop/prod_kis');
  });

  it('uses another product’s own primary photo with its dimensions', () => {
    const meta = productMetadata({ product: gloves, comingSoon: false });
    const og = meta.openGraph as { images?: Array<{ url: string; width?: number; height?: number; alt?: string }> };
    expect(og.images?.[0]).toEqual({ url: image.url, width: 1200, height: 1500, alt: 'KIS Pro Gloves' });
    const tw = meta.twitter as { images?: string[] };
    expect(tw.images).toEqual([image.url]);
  });

  it('falls back to the store card for a product with no photo at all', () => {
    const meta = productMetadata({ product: { ...gloves, primaryImage: null }, comingSoon: false });
    const og = meta.openGraph as { images?: unknown[] };
    expect(og.images?.[0]).toEqual(STORE_SHARE_IMAGE);
  });

  it('URL-encodes the id in the canonical path', () => {
    const meta = productMetadata({ product: { ...gloves, id: 'a b/c' }, comingSoon: false });
    expect(meta.alternates?.canonical).toBe('/shop/a%20b%2Fc');
  });
});
