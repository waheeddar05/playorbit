import { KIS_PHOTOS, type KisPhoto } from './kis-photos';

export type { KisPhoto };
export { KIS_PHOTOS };

/**
 * The one bat the store stocks, as the marketing surfaces say it.
 *
 * Price, stock and the product link are deliberately NOT here — those
 * come from the catalog row so the spotlight can never contradict the
 * product page. This block is only the copy that does not change when
 * someone edits a price in the admin panel.
 *
 * The claims mirror the M&H 7000's specs in scripts/kis-catalog.json;
 * keep the two in step if the spec sheet changes.
 */
export const KIS_MODEL = {
  brand: 'KIS',
  /** Short form, for the oversized display type. */
  model: 'M&H 7000',
  /** How the catalog names it — used when we need the full product name. */
  fullName: 'KIS M&H 7000',
  origin: 'Anantnag, Kashmir',
  eyebrow: 'The only bat we stock',
  headline: 'ONE BAT.',
  headlineAccent: 'PICKED IN PERSON.',
  blurb:
    'Grade A++ Kashmir willow from the KIS press, hand-finished and knocked in ready. Every cleft is different — feel the pickup on two or three before you decide.',
  claims: ['Grade A++ Kashmir willow', 'Knocked in ready', 'Hand-finished', 'Made in Anantnag'] as const,
} as const;

/**
 * The claims, expanded to a line each — the highlights strip on /shop
 * and the product page. Icons are chosen in the component; this module
 * stays free of React so the metadata and tests can read it.
 */
export const KIS_HIGHLIGHTS = [
  {
    key: 'willow',
    title: 'Grade A++ Kashmir willow',
    text: 'Top-grade clefts, pressed at the KIS works in Anantnag.',
  },
  {
    key: 'ready',
    title: 'Knocked in ready',
    text: 'Hours of prep already done — face a hard ball from day one.',
  },
  {
    key: 'hand',
    title: 'Hand-finished',
    text: 'Shaped and finished by people who play, not just pressed.',
  },
  {
    key: 'origin',
    title: 'Made in Anantnag',
    text: 'KIS has pressed and finished Kashmir willow there since 1994.',
  },
] as const;

export type KisHighlightKey = (typeof KIS_HIGHLIGHTS)[number]['key'];

/**
 * How the bat reaches a customer, in three steps — one set while the
 * store takes pre-bookings, one once it sells from stock. The wording
 * mirrors the product page's own buttons ("Pre-book", "Order on
 * WhatsApp") so the steps describe what the page actually does.
 */
export const KIS_STEPS = {
  prebook: [
    { title: 'Pre-book in the app', text: 'Pick a quantity and tap Pre-book. Nothing to pay now.' },
    { title: 'We hold one for you', text: 'The store confirms and messages you the moment it’s ready.' },
    { title: 'Hand-pick, then pay on collection', text: 'Feel the pickup on two or three before you choose yours.' },
  ],
  order: [
    { title: 'Order on WhatsApp', text: 'Quantity and delivery address go into the message, ready to send.' },
    { title: 'We confirm', text: 'The store replies with availability and how to pay.' },
    { title: 'Collect or get it delivered', text: 'Hand-pick at the store, or arrange delivery in the same chat.' },
  ],
} as const;

function pick(slugs: readonly string[]): KisPhoto[] {
  return slugs.flatMap((slug) => {
    const photo = KIS_PHOTOS.find((p) => p.slug === slug);
    return photo ? [photo] : [];
  });
}

/**
 * The frames the spotlight cross-fades through, strongest first — the
 * snow shot is the one that stops a scroll, so it is what a visitor
 * sees before the rotation starts.
 */
export const KIS_HERO_PHOTOS: readonly KisPhoto[] = pick(['snow', 'trio', 'gloves', 'pair', 'showroom']);

/** The two frames stacked behind the spotlight's main plate on desktop. */
export const KIS_STACK_PHOTOS: readonly KisPhoto[] = pick(['logs', 'kitbag']);

/**
 * The moving band. Ordered so no two neighbouring frames share a
 * background — snow, then workshop, then yard — because the marquee
 * loops and adjacent lookalikes read as a stutter.
 */
export const KIS_MARQUEE_PHOTOS: readonly KisPhoto[] = pick([
  'snow',
  'logs',
  'gloves',
  'trio',
  'showroom',
  'kitbag',
  'pair',
  'blade',
]);

/**
 * One frame for thumbnail-sized slots (the booking-screen promo strip).
 * The single-bat shot on purpose: at 32px the group shots are mush.
 */
export const KIS_PROMO_PHOTO: KisPhoto | undefined = pick(['blade'])[0];

/** The short band used near the top of the landing page. */
export const KIS_RIBBON_PHOTOS: readonly KisPhoto[] = pick(['snow', 'trio', 'gloves', 'logs', 'showroom']);

/**
 * Is this catalog row the bat the showcase is about?
 *
 * Matched on brand plus a punctuation-insensitive model number, because
 * the name is typed by a store admin and has already been seen as
 * "KIS M&H 7000", "KIS M & H 7000" and "KIS MH7000". A row that is not
 * this bat must never pull the M&H 7000 photography in behind it — the
 * point of the showcase is that it is honest about showing one product.
 */
export function isKisModel(row: { brand?: string | null; name?: string | null }): boolean {
  const brand = (row.brand ?? '').trim().toUpperCase();
  if (brand !== KIS_MODEL.brand) return false;
  const name = (row.name ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return name.includes('MH7000');
}
