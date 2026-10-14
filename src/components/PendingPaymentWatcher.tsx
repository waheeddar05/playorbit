'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import {
  readPendingPayment,
  clearPendingPayment,
  getActiveCheckout,
  fetchPaymentStatus,
  PAYMENT_FULFILLED_EVENT,
  PENDING_PAYMENT_ABANDON_MS,
} from '@/lib/pending-payment';

/**
 * Resolves a Razorpay checkout that the page itself couldn't finish.
 *
 * When the customer pays in their UPI app and minimises PlayOrbit, Chrome
 * may discard the backgrounded page: on return it reloads, the checkout's
 * promise and handler are gone, and the booking used to surface only once
 * the customer opened My Bookings. On app open and every return to the
 * foreground this asks the server about the payment the last checkout
 * recorded and, once it is booked, says so and goes to My Bookings.
 *
 * A checkout still live on the current page is left to useRazorpay.
 */
export function PendingPaymentWatcher() {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const checking = useRef(false);

  useEffect(() => {
    const check = async () => {
      if (checking.current || document.visibilityState !== 'visible') return;
      const pending = readPendingPayment();
      if (!pending || getActiveCheckout() === pending.paymentId) return;

      checking.current = true;
      try {
        const status = await fetchPaymentStatus(pending.paymentId);
        if (!status) return; // offline / signed out — try again next time

        if (status.state === 'fulfilled') {
          clearPendingPayment(pending.paymentId);
          window.dispatchEvent(new CustomEvent(PAYMENT_FULFILLED_EVENT, { detail: status }));
          if (pending.type === 'PACKAGE_PURCHASE') {
            toast.success('Payment successful!', 'Your package is active.');
          } else {
            const n = status.bookingIds.length;
            toast.success('Payment successful!', `Booked ${n} slot${n === 1 ? '' : 's'}.`);
            if (pathnameRef.current !== '/bookings') router.push('/bookings');
          }
          return;
        }

        if (status.state === 'refunded') {
          clearPendingPayment(pending.paymentId);
          toast.error(
            'Booking could not be completed',
            status.error || 'Your payment has been refunded.',
          );
          return;
        }

        if (status.state === 'failed' || Date.now() - pending.createdAt > PENDING_PAYMENT_ABANDON_MS) {
          // Never paid (or long abandoned). A very late payment is still
          // picked up by recover-mine and the reconcile cron.
          clearPendingPayment(pending.paymentId);
        }
      } finally {
        checking.current = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };

    void check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('online', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
