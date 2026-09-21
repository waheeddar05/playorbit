'use client';

import Image from 'next/image';
import type { KisPhoto } from '@/lib/kis-showcase';

interface KisFrameProps {
  photo: KisPhoto;
  /** Required: these frames are cropped hard, so the browser must be told the real render width. */
  sizes: string;
  priority?: boolean;
  /** Extra classes on the <img> itself (hover transforms, drift). */
  className?: string;
}

/**
 * One M&H 7000 photograph, filling a positioned parent.
 *
 * Every showcase surface crops these 4:5 portraits into a different box
 * — a 16:6 band, a square plate, a thumbnail — so the frame always
 * applies the photo's own focal point rather than centring blindly,
 * which is what pushed the blade out of shot in the wide bands.
 *
 * The 14px LQIP baked into the manifest is the placeholder: without it
 * each photo pops in from the black plate behind it, and there are
 * eight of them on a page.
 */
export function KisFrame({ photo, sizes, priority, className = '' }: KisFrameProps) {
  return (
    <Image
      src={photo.src}
      alt={photo.alt}
      fill
      sizes={sizes}
      priority={priority}
      placeholder="blur"
      blurDataURL={photo.blurDataURL}
      style={{ objectPosition: photo.focal }}
      className={`object-cover ${className}`}
    />
  );
}
