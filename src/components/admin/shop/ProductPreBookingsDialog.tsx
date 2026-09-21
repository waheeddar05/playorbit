'use client';

/**
 * The pre-booking list for one product — the thing the store actually
 * works.
 *
 * Every row is somebody who asked us to hold a bat before we were
 * selling from stock. **No money has changed hands on any of them**, so
 * there is nothing to settle, refund or reconcile here: the statuses
 * track a conversation (new → holding → collected, or cancelled) and the
 * note is where what was agreed on the phone gets written down.
 *
 * Cancelled rows stay visible. By the time somebody calls off a booking
 * the store has usually already set a bat aside, and a row that
 * disappears is worse than one marked off.
 */

import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, Loader2, MapPin, Phone, RotateCcw } from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useToast } from '@/components/ui/Toast';
import {
  PRE_BOOKING_STATUS_LABELS,
  formatRupees,
  isActivePreBooking,
  type MarketplacePreBookingView,
  type MarketplaceProductAdminView,
  type PreBookingStatus,
} from '@/lib/marketplace';
import { formatDateTime, readApiError, secondaryButtonClass } from './common';
import { ShopDialog } from './ShopDialog';
import type { ProductDetailResponse } from './types';

interface Props {
  product: MarketplaceProductAdminView;
  onClose: () => void;
  /** Fired when a status changed, so the list behind can refresh its count. */
  onChanged?: () => void;
}

const STATUS_TONE: Record<PreBookingStatus, string> = {
  PENDING: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
  CONFIRMED: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
  FULFILLED: 'bg-white/[0.06] border-white/[0.1] text-slate-300',
  CANCELLED: 'bg-white/[0.03] border-white/[0.08] text-slate-500',
};

/** What this row can become next, in the order the store would reach for. */
function nextSteps(status: PreBookingStatus): Array<{ to: PreBookingStatus; label: string }> {
  switch (status) {
    case 'PENDING':
      return [
        { to: 'CONFIRMED', label: 'Holding' },
        { to: 'CANCELLED', label: 'Cancel' },
      ];
    case 'CONFIRMED':
      return [
        { to: 'FULFILLED', label: 'Collected' },
        { to: 'CANCELLED', label: 'Cancel' },
      ];
    default:
      return [{ to: 'PENDING', label: 'Reopen' }];
  }
}

export function ProductPreBookingsDialog({ product, onClose, onChanged }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<MarketplacePreBookingView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setError(null);
      setRows(null);
      try {
        const res = await fetch(`/api/admin/shop/products/${product.id}`, { signal: controller.signal });
        if (!res.ok) throw new Error(await readApiError(res, "Couldn't load the pre-bookings"));
        const json = (await res.json()) as ProductDetailResponse;
        setRows(json.preBookings);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : "Couldn't load the pre-bookings");
      }
    })();
    return () => controller.abort();
  }, [product.id, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const move = async (row: MarketplacePreBookingView, to: PreBookingStatus) => {
    setBusyId(row.id);
    // Applied locally first, and rolled back on failure — the store works
    // down a list of these and a round-trip between each one is felt.
    const before = rows;
    setRows((list) => list?.map((r) => (r.id === row.id ? { ...r, status: to } : r)) ?? list);
    try {
      const res = await fetch(`/api/admin/shop/products/${product.id}/prebookings/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Couldn't update the pre-booking"));
      onChanged?.();
    } catch (err) {
      setRows(before ?? null);
      toast.error('Update failed', err instanceof Error ? err.message : 'Please try again');
    } finally {
      setBusyId(null);
    }
  };

  const waiting = rows?.filter((r) => isActivePreBooking(r.status)) ?? [];
  const bats = waiting.reduce((n, r) => n + r.quantity, 0);

  return (
    <ShopDialog
      title="Pre-bookings"
      subtitle={product.name}
      size="lg"
      onClose={onClose}
      footer={
        <>
          {rows && rows.length > 0 && (
            <span className="mr-auto text-xs text-slate-500 tabular-nums">
              {waiting.length} waiting · {bats} {bats === 1 ? 'bat' : 'bats'} to hold
            </span>
          )}
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Close
          </button>
        </>
      }
    >
      {error ? (
        <ErrorState message={error} onRetry={retry} className="py-8" />
      ) : rows === null ? (
        <LoadingState size="sm" message="Loading…" />
      ) : rows.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
            <CalendarCheck className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-sm font-medium text-slate-300">No pre-bookings yet</p>
          <p className="text-xs text-slate-500 mt-1">
            While the store is in Pre-book mode, customers tap Pre-book on the product page and land here.
            Nothing is charged — you get in touch and hold one for them.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.05] -mx-1">
          {rows.map((r) => {
            const busy = busyId === r.id;
            const muted = !isActivePreBooking(r.status);
            return (
              <li key={r.id} className={`px-1 py-3 transition-opacity ${muted ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={`text-sm truncate ${
                        r.contactName || r.name ? 'text-white font-medium' : 'text-slate-500 italic'
                      }`}
                    >
                      {r.contactName || r.name || 'No name'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                      {r.quantity} × {formatRupees(r.unitPrice)}
                      {r.size ? ` · ${r.size}` : ''}
                      <span className="text-slate-600"> · </span>
                      {formatDateTime(r.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[r.status]}`}
                  >
                    {PRE_BOOKING_STATUS_LABELS[r.status]}
                  </span>
                </div>

                {r.addressText && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-500 leading-snug whitespace-pre-line">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-accent/60" aria-hidden="true" />
                    {r.addressText}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {(r.contactPhone || r.mobileNumber) && (
                    <a
                      href={`tel:${r.contactPhone || r.mobileNumber}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent px-2.5 py-1.5 text-xs font-semibold tabular-nums hover:bg-accent/15 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {r.contactPhone || r.mobileNumber}
                    </a>
                  )}
                  {nextSteps(r.status).map((step) => (
                    <button
                      key={step.to}
                      type="button"
                      onClick={() => void move(r, step.to)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : step.to === 'PENDING' ? (
                        <RotateCcw className="w-3.5 h-3.5" />
                      ) : null}
                      {step.label}
                    </button>
                  ))}
                </div>

                {r.adminNote && <p className="mt-1.5 text-[11px] text-slate-400 italic">{r.adminNote}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </ShopDialog>
  );
}
