'use client';

/**
 * Client-side memory of a Razorpay checkout that hasn't resolved yet.
 *
 * The booking is created when Razorpay's in-page `handler` calls
 * `/api/payments/verify`. On Android the customer pays in their UPI app
 * and often minimises PlayOrbit straight after; Chrome freezes or
 * discards the backgrounded page and that call never lands. We record
 * the payment in localStorage when the order is created, so that when
 * the app comes back — same page or a fresh load — we can ask the server
 * what happened (`/api/payments/status`, which reconciles against
 * Razorpay) instead of waiting for the customer to open My Bookings.
 */

const STORAGE_KEY = 'po:pendingPayment';

/** Dispatched on `window` when a payment is confirmed out-of-band, so an
 *  open My Bookings / packages page can refetch. */
export const PAYMENT_FULFILLED_EVENT = 'po:payment-fulfilled';

/** Past this a still-unpaid order is treated as abandoned and forgotten.
 *  Anything paid later is still caught by recover-mine and the cron. */
export const PENDING_PAYMENT_ABANDON_MS = 30 * 60 * 1000;

export type PendingPaymentType = 'SLOT_BOOKING' | 'PACKAGE_PURCHASE';

export interface PendingPayment {
  paymentId: string;
  type: PendingPaymentType;
  createdAt: number;
}

export interface PaymentStatus {
  state: 'fulfilled' | 'pending' | 'refunded' | 'failed';
  paymentId: string;
  type: PendingPaymentType;
  razorpayPaymentId: string | null;
  bookingIds: string[];
  userPackageId: string | null;
  error: string | null;
}

export function savePendingPayment(p: PendingPayment): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable — the resume check just won't run */
  }
}

export function readPendingPayment(): PendingPayment | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingPayment;
    return p && typeof p.paymentId === 'string' ? p : null;
  } catch {
    return null;
  }
}

/** Forget the pending payment — only if it is still the one given, so a
 *  newer checkout's record is never wiped by an older one finishing. */
export function clearPendingPayment(paymentId: string): void {
  try {
    if (readPendingPayment()?.paymentId === paymentId) localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// The Razorpay hook owns a checkout while its modal is live on this page;
// the app-wide watcher stands down for that payment so the two don't
// both report the same booking.
let activeCheckoutPaymentId: string | null = null;

export function setActiveCheckout(paymentId: string | null): void {
  activeCheckoutPaymentId = paymentId;
}

export function getActiveCheckout(): string | null {
  return activeCheckoutPaymentId;
}

/** Ask the server for the payment's outcome. `null` means we couldn't
 *  tell (offline, signed out, server error) — keep it pending. */
export async function fetchPaymentStatus(paymentId: string): Promise<PaymentStatus | null> {
  try {
    const res = await fetch(`/api/payments/status?paymentId=${encodeURIComponent(paymentId)}`, {
      cache: 'no-store',
    });
    if (res.status === 404) {
      // Not ours / gone — nothing to wait for.
      return {
        state: 'failed',
        paymentId,
        type: 'SLOT_BOOKING',
        razorpayPaymentId: null,
        bookingIds: [],
        userPackageId: null,
        error: null,
      };
    }
    if (!res.ok) return null;
    return (await res.json()) as PaymentStatus;
  } catch {
    return null;
  }
}
