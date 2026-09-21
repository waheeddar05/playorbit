'use client';

import { BadgeCheck, Hand, Mountain, TreePine, type LucideIcon } from 'lucide-react';
import { KIS_HIGHLIGHTS, type KisHighlightKey } from '@/lib/kis-showcase';

const ICONS: Record<KisHighlightKey, LucideIcon> = {
  willow: TreePine,
  ready: BadgeCheck,
  hand: Hand,
  origin: Mountain,
};

interface KisHighlightsProps {
  /** `grid` is the /shop section (2×2, 4-up on desktop); `compact` the product page's tighter 2×2. */
  variant?: 'grid' | 'compact';
  className?: string;
}

/**
 * Why this bat — the four claims from `KIS_MODEL`, each with a line of
 * explanation and an icon, so the reasons to buy are read at a glance
 * rather than mined out of a spec table. Only ever shown for the M&H
 * 7000: the copy is about that bat.
 */
export function KisHighlights({ variant = 'grid', className = '' }: KisHighlightsProps) {
  const compact = variant === 'compact';
  return (
    <ul
      className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-2.5 md:grid-cols-4'} ${className}`}
      aria-label="Why this bat"
    >
      {KIS_HIGHLIGHTS.map((item) => {
        const Icon = ICONS[item.key];
        return (
          <li
            key={item.key}
            className={`rounded-xl border border-white/[0.07] bg-white/[0.03] ${compact ? 'p-2.5' : 'p-3 md:p-3.5'} min-w-0`}
          >
            <span
              className={`flex items-center justify-center rounded-lg bg-accent/10 text-accent ${
                compact ? 'w-7 h-7' : 'w-8 h-8 md:w-9 md:h-9'
              }`}
            >
              <Icon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} aria-hidden="true" />
            </span>
            <p className={`font-bold text-white leading-snug ${compact ? 'text-xs mt-2' : 'text-xs md:text-sm mt-2.5'}`}>
              {item.title}
            </p>
            <p className={`text-slate-400 leading-snug mt-0.5 ${compact ? 'text-[10px]' : 'text-[11px] md:text-xs'}`}>
              {item.text}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
