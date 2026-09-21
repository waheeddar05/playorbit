'use client';

import { useState, useSyncExternalStore } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface ShareButtonProps {
  /** The share sheet's title (the product name). */
  title: string;
  /** The line that lands in the chat, above the link. See `buildShareText`. */
  text: string;
  /** Absolute URL, or null until the page knows its origin — the button waits. */
  url: string | null;
  /** `text` is the quiet inline link the product page's meta row uses; `pill` a small bordered button. */
  variant?: 'text' | 'pill';
  className?: string;
}

// `navigator.share` exists only in the browser, so the label the server
// renders ("Copy link") and the one the phone should show ("Share")
// differ. Read it through useSyncExternalStore: the server snapshot is
// false, the client fills in the truth after hydration without an effect
// or a mismatch.
const subscribeNoop = () => () => {};
const readCanShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const readCanShareOnServer = () => false;

/**
 * Share a store link the way the phone shares things.
 *
 * On a phone this opens the native share sheet — WhatsApp is one tap
 * away, which is where the store's customers are. On a desktop, or a
 * browser without the Web Share API, it copies the link instead and says
 * so. A cancelled sheet is not an error and gets no toast; a sheet that
 * throws for any other reason falls back to the copy.
 */
export function ShareButton({ title, text, url, variant = 'text', className = '' }: ShareButtonProps) {
  const toast = useToast();
  const canShare = useSyncExternalStore(subscribeNoop, readCanShare, readCanShareOnServer);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!url) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      toast.error('Copying isn’t available here', 'Long-press the address bar to copy the link instead.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied', 'Share it with a friend or on WhatsApp.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Couldn’t copy the link', 'Long-press the address bar to copy it instead.');
    }
  };

  const share = async () => {
    if (!url) return;
    if (!canShare) {
      await copy();
      return;
    }
    try {
      await navigator.share({ title, text, url });
    } catch (err) {
      // The person closed the sheet — nothing to report.
      if (err instanceof Error && err.name === 'AbortError') return;
      await copy();
    }
  };

  const label = canShare ? 'Share' : copied ? 'Copied' : 'Copy link';
  const Icon = canShare ? Share2 : copied ? Check : Copy;
  const iconTone = !canShare && copied ? 'text-emerald-400' : '';

  const base =
    variant === 'pill'
      ? 'inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white'
      : 'inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white';

  return (
    <button
      type="button"
      onClick={() => void share()}
      disabled={!url}
      aria-label={canShare ? `Share ${title}` : `Copy link to ${title}`}
      className={`${base} transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${className}`}
    >
      <Icon className={`w-3.5 h-3.5 ${iconTone}`} />
      {label}
    </button>
  );
}
