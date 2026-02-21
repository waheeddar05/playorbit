'use client';

import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: { icon: 'w-4 h-4', text: 'text-xs', padding: 'py-8' },
  md: { icon: 'w-6 h-6', text: 'text-sm', padding: 'py-16' },
  lg: { icon: 'w-8 h-8', text: 'text-base', padding: 'py-20' },
};

export function LoadingState({ message = 'Loading...', size = 'md', className = '' }: LoadingStateProps) {
  const styles = SIZE_MAP[size];

  return (
    <div className={`flex flex-col items-center justify-center text-slate-400 ${styles.padding} ${className}`}>
      <Loader2 className={`${styles.icon} animate-spin mb-2`} />
      <span className={styles.text}>{message}</span>
    </div>
  );
}

// ─── Skeleton Variants ───────────────────────────────────
export function SlotSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] animate-pulse"
        >
          <div className="h-4 w-12 bg-white/10 rounded mb-1.5" />
          <div className="h-3 w-16 bg-white/5 rounded mb-2" />
          <div className="flex justify-between">
            <div className="h-3 w-10 bg-white/5 rounded" />
            <div className="h-3 w-8 bg-white/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BookingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-4 animate-pulse"
        >
          <div className="flex justify-between mb-3">
            <div className="h-5 w-20 bg-white/10 rounded-full" />
            <div className="h-5 w-14 bg-white/5 rounded" />
          </div>
          <div className="h-5 w-32 bg-white/10 rounded mb-2" />
          <div className="h-4 w-40 bg-white/5 rounded mb-3" />
          <div className="pt-3 border-t border-white/[0.06] flex justify-between">
            <div className="h-3 w-24 bg-white/5 rounded" />
            <div className="h-4 w-12 bg-white/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
