'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BadgeCheck, CalendarCheck, Loader2, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { loginHref } from '@/lib/login-href';
import { formatRupees, type MyPreBookingView } from '@/lib/marketplace';

interface PreBookActionProps {
  productId: string;
  productName: string;
  /** The viewer's standing pre-booking, or null when they have none. */
  preBooking: MyPreBookingView | null;
  onChange: (next: MyPreBookingView | null) => void;
  /** Current selections, used only when creating or revising. */
  quantity: number;
  size: string | null;
  signedIn: boolean;
}

/**
 * Pre-book this product, in the app.
 *
 * **Nothing is charged, here or anywhere downstream.** Tapping the
 * button writes one row and sends the customer a notification; the store
 * reads the list and gets in touch. There is no payment step to add
 * later in this flow — if one is ever wanted, it belongs after the store
 * confirms, not here.
 *
 * Two states in one component because they are the same decision seen
 * from either side: nothing booked yet → the button; booked → what we
 * are holding, and the way out. An anonymous tap goes to sign-in and
 * returns to this product, the same route "Notify me" used.
 */
export function PreBookAction({
  productId,
  productName,
  preBooking,
  onChange,
  quantity,
  size,
  signedIn,
}: PreBookActionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const signInHref = loginHref(pathname);

  const call = async (method: 'POST' | 'DELETE') => {
    setPending(true);
    try {
      const res = await fetch(`/api/shop/products/${encodeURIComponent(productId)}/prebook`, {
        method,
        ...(method === 'POST'
          ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity, size }) }
          : {}),
      });
      if (res.status === 401) {
        router.push(signInHref);
        return;
      }
      const isJson = res.headers.get('content-type')?.includes('application/json') ?? false;
      const body: unknown = isJson ? await res.json() : null;
      if (!res.ok) {
        const message =
          body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
            ? (body as { error: string }).error
            : 'Something went wrong';
        throw new Error(message);
      }
      const next =
        body && typeof body === 'object' && 'preBooking' in body
          ? ((body as { preBooking: MyPreBookingView | null }).preBooking ?? null)
          : null;
      onChange(next);
      if (next) {
        toast.success('Pre-booked', `We’ve noted ${next.quantity} × ${productName}. Nothing to pay now.`);
      } else {
        toast.info('Pre-booking cancelled', 'We won’t hold one for you.');
      }
    } catch (err) {
      toast.error(
        method === 'POST' ? 'Couldn’t pre-book' : 'Couldn’t cancel',
        err instanceof Error ? err.message : 'Please try again',
      );
    } finally {
      setPending(false);
    }
  };

  if (preBooking) {
    const holding = preBooking.status === 'CONFIRMED';
    return (
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          <BadgeCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-emerald-300 leading-snug">
              {holding ? 'We’re holding one for you' : 'Pre-booked'}
            </p>
            <p className="text-[11px] text-slate-400 leading-snug mt-0.5 tabular-nums">
              {preBooking.quantity} × {formatRupees(preBooking.unitPrice)}
              {preBooking.size ? ` · ${preBooking.size}` : ''} · nothing to pay
            </p>
            <p className="text-[11px] text-slate-500 leading-snug mt-1">
              {holding
                ? 'We’ll message you when it’s ready to collect.'
                : 'We’ll confirm shortly and message you when it’s ready.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void call('DELETE')}
            disabled={pending}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => (signedIn ? void call('POST') : router.push(signInHref))}
      disabled={pending}
      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold bg-accent hover:bg-accent-light text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
      {signedIn ? 'Pre-book' : 'Sign in to pre-book'}
    </button>
  );
}
