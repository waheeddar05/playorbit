'use client';

import { KIS_STEPS } from '@/lib/kis-showcase';

interface KisHowItWorksProps {
  /** Store-wide pre-launch state — picks the pre-booking steps or the ordering ones. */
  comingSoon: boolean;
  className?: string;
}

/**
 * The three steps between "I want this bat" and holding it, so a
 * first-time visitor knows what tapping the button commits them to
 * before they tap it — in pre-launch, that nothing is paid until they
 * have the bat in hand. Reads the same copy in both places it appears
 * (/shop and the product page).
 */
export function KisHowItWorks({ comingSoon, className = '' }: KisHowItWorksProps) {
  const steps = comingSoon ? KIS_STEPS.prebook : KIS_STEPS.order;
  return (
    <section className={className} aria-labelledby="kis-how-it-works">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 id="kis-how-it-works" className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          How it works
        </h2>
        <p className="text-[10px] text-slate-500">{comingSoon ? 'Pre-booking, in three steps' : 'Ordering, in three steps'}</p>
      </div>
      <ol className="grid gap-2 md:grid-cols-3">
        {steps.map((step, i) => (
          <li
            key={step.title}
            className="flex md:flex-col items-start gap-3 md:gap-2 rounded-xl border border-white/[0.07] bg-[#060d1b]/70 p-3 min-w-0"
          >
            <span className="shrink-0 w-7 h-7 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-black flex items-center justify-center tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-xs md:text-sm font-bold text-white leading-snug">{step.title}</p>
              <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
