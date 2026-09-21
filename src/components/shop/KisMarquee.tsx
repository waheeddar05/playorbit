'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion';
import { KIS_MARQUEE_PHOTOS, KIS_MODEL, type KisPhoto } from '@/lib/kis-showcase';
import { KisFrame } from './KisFrame';

type MarqueeSize = 'slim' | 'tall';

const SIZE: Record<MarqueeSize, { box: string; sizes: string; spacing: string }> = {
  slim: { box: 'h-20 md:h-28', sizes: '(max-width: 768px) 64px, 90px', spacing: 'mr-2 md:mr-3' },
  tall: { box: 'h-36 md:h-52', sizes: '(max-width: 768px) 115px, 170px', spacing: 'mr-2.5 md:mr-4' },
};

/** Feathered ends, so the band bleeds out instead of stopping at a hard edge on any background. */
const EDGE_FADE = 'linear-gradient(to right, transparent, #000 5%, #000 95%, transparent)';

interface KisMarqueeProps {
  size?: MarqueeSize;
  /** Where a tapped frame goes. Omit for a purely decorative band. */
  href?: string;
  /** Seconds for one full pass; longer reads calmer. */
  duration?: number;
  photos?: readonly KisPhoto[];
  className?: string;
}

/**
 * The moving band of M&H 7000 photography.
 *
 * The track holds the list twice and slides exactly half its width, so
 * the second copy arrives where the first began and the loop has no
 * seam. That only holds if every item carries its own trailing gap —
 * with a flex `gap` the track is `2n` items but `2n-1` gaps, and half
 * of that lands half a gap out of register, which shows up as a small
 * jolt once per pass.
 *
 * The duplicate copy is `aria-hidden` and out of the tab order;
 * otherwise every photo is announced and tabbed through twice.
 *
 * With reduced motion on this becomes an ordinary horizontal scroller:
 * same photos, same order, no movement. The global
 * prefers-reduced-motion rule cannot rescue a transform animation — it
 * would freeze the track at -50% — so the swap happens here.
 */
export function KisMarquee({
  size = 'slim',
  href,
  duration = 52,
  photos = KIS_MARQUEE_PHOTOS,
  className = '',
}: KisMarqueeProps) {
  const reducedMotion = usePrefersReducedMotion();
  const { box, sizes, spacing } = SIZE[size];

  if (photos.length === 0) return null;

  const frame = (photo: KisPhoto, key: string, decorative: boolean) => {
    const inner = (
      <>
        <KisFrame
          photo={photo}
          sizes={sizes}
          className="transition-transform duration-700 group-hover/frame:scale-105"
        />
        <span className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/[0.07]" />
      </>
    );
    const shell = `group/frame relative shrink-0 aspect-[4/5] ${box} ${spacing} rounded-lg md:rounded-xl overflow-hidden bg-[#050b14]`;

    if (!href) {
      return (
        <div key={key} className={shell} aria-hidden={decorative || undefined}>
          {inner}
        </div>
      );
    }
    return (
      <Link
        key={key}
        href={href}
        aria-label={decorative ? undefined : photo.alt}
        aria-hidden={decorative || undefined}
        tabIndex={decorative ? -1 : undefined}
        className={`${shell} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
      >
        {inner}
      </Link>
    );
  };

  const maskStyle: CSSProperties = { maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE };

  if (reducedMotion) {
    return (
      <div
        className={`overflow-x-auto scrollbar-hide ${className}`}
        style={maskStyle}
        role="group"
        aria-label={`${KIS_MODEL.fullName} photos`}
      >
        <div className="flex w-max px-4">{photos.map((photo) => frame(photo, photo.slug, false))}</div>
      </div>
    );
  }

  return (
    <div
      className={`kis-marquee relative overflow-hidden ${className}`}
      style={{ ...maskStyle, '--kis-marquee-duration': `${duration}s` } as CSSProperties}
      role="group"
      aria-label={`${KIS_MODEL.fullName} photos`}
    >
      <div className="kis-marquee-track flex w-max">
        {photos.map((photo) => frame(photo, photo.slug, false))}
        {photos.map((photo) => frame(photo, `${photo.slug}-echo`, true))}
      </div>
    </div>
  );
}
