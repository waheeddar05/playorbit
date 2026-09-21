'use client';

import { useSyncExternalStore } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * Whether the visitor has asked for reduced motion.
 *
 * `globals.css` already clamps every CSS animation to one 0.01ms pass
 * under that media query, which is the right answer for a fade or a
 * pulse but the wrong one for anything that animates *position*: a
 * marquee would snap to its end transform and sit there looking broken,
 * and a cross-fade carousel would jump. Those components read this hook
 * and render a static, scrollable variant instead of relying on the
 * blanket CSS rule.
 *
 * The server snapshot is `false` so SSR and hydration agree; the real
 * value takes over on the client immediately after.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}
