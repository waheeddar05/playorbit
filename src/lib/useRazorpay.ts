'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  savePendingPayment,
  clearPendingPayment,
  setActiveCheckout,
  fetchPaymentStatus,
  type PaymentStatus,
} from './pending-payment';

interface KitRentalConfig {
  enabled: boolean;
  /** Default per-slot price. Used as a fallback for resource-based
   *  centers that haven't overridden a specific Machine row. */
  price: number;
  title: string;
  description: string;
  note: string;
  /** ABCA enum allowlist (GRAVITY/YANTRA/...). Toplay et al. ignore
   *  this and use `machineRowConfigs` instead. */
  machines: string[];
  /** RESOURCE_BASED centers only. Per-machine-row toggle + price so
   *  each Machine has its own kit rental config. Keyed by Machine.id. */
  machineRowConfigs?: Record<string, { enabled: boolean; price: number }>;
}

interface PaymentConfig {
  paymentEnabled: boolean;
  slotPaymentRequired: boolean;
  packagePaymentRequired: boolean;
  razorpayKeyId: string;
  cashPaymentEnabled: boolean;
  walletEnabled: boolean;
  kitRentalConfig?: KitRentalConfig;
  /** Center-wide toggles for the user-side ball / pitch chip rows.
   *  Defaults to true (chips visible) when nothing is configured;
   *  admins can flip to false on the configuration page to force-pick
   *  the first supported value per machine and hide the picker. */
  ballTypeSelectionEnabled?: boolean;
  pitchTypeSelectionEnabled?: boolean;
  /** Must-read facility rule shown in red on the booking confirmation.
   *  Resolved center → global → `DEFAULT_BOOKING_NOTICE`; an empty string
   *  means the center turned the notice off. */
  bookingNotice?: string;
}

interface RazorpayOrderResponse {
  orderId: string;
  paymentId: string; // Our internal payment ID
  amount: number; // in paise
  currency: string;
  keyId: string;
  /** Name of the center the order belongs to. Shown as the merchant name
   *  in the Razorpay Checkout modal so each center brands its own account
   *  instead of every center showing "ABCA Cricket Academy". */
  centerName?: string;
  /** Optional per-center accent color for the checkout modal. */
  centerThemeColor?: string | null;
}

export interface PaymentResult {
  paymentId: string;
  razorpayPaymentId: string;
  type: string;
  bookings?: Array<{ id: string; status: string }> | null;
}

interface UseRazorpayOptions {
  onSuccess?: (data: PaymentResult) => void;
  onFailure?: (error: string) => void;
  /** The customer paid but we couldn't confirm the booking yet (the
   *  verify call didn't reach us). Not a failure — the booking is
   *  confirmed in the background. Falls back to `onFailure`. */
  onPending?: (message: string) => void;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      close: () => void;
      on: (event: string, handler: () => void) => void;
    };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function usePaymentConfig() {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/payments/config')
      .then((res) => res.json())
      .then(setConfig)
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, []);

  return { config, loading };
}

export function useRazorpay(options: UseRazorpayOptions = {}, paymentEnabled = true) {
  const [processing, setProcessing] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    // Only load Razorpay script when payment is actually enabled
    if (paymentEnabled) {
      loadRazorpayScript().then(setScriptLoaded);
    }
  }, [paymentEnabled]);

  const initiatePayment = useCallback(
    async (params: {
      type: 'SLOT_BOOKING' | 'PACKAGE_PURCHASE';
      amount: number;
      packageId?: string;
      slots?: Array<{ date: string; startTime: string; endTime: string }>;
      metadata?: Record<string, string>;
      prefill?: { name?: string; email?: string; contact?: string };
      description?: string;
      walletDeduction?: number;
      bookingPayload?: Record<string, unknown>[];
    }) => {
      if (!scriptLoaded) {
        options.onFailure?.('Razorpay SDK not loaded. Please refresh and try again.');
        return null;
      }

      setProcessing(true);

      try {
        // Step 1: Create order on our backend
        const orderRes = await fetch('/api/payments/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: params.type,
            amount: params.amount,
            packageId: params.packageId,
            slots: params.slots,
            metadata: params.metadata,
            walletDeduction: params.walletDeduction,
            bookingPayload: params.bookingPayload,
          }),
        });

        if (!orderRes.ok) {
          const err = await orderRes.json();
          throw new Error(err.error || 'Failed to create payment order');
        }

        const order: RazorpayOrderResponse = await orderRes.json();

        // Remember the checkout until we know how it ended, so it can be
        // resolved from the server if this page is frozen or discarded
        // while the customer is in their UPI app (see pending-payment.ts).
        savePendingPayment({ paymentId: order.paymentId, type: params.type, createdAt: Date.now() });
        setActiveCheckout(order.paymentId);

        // Step 2: Open Razorpay checkout
        return new Promise<PaymentResult | null>(
          (resolve) => {
            let settled = false;
            let verifying = false;
            let resumeTimer: ReturnType<typeof setTimeout> | null = null;
            let rzp: InstanceType<Window['Razorpay']> | null = null;

            const toResult = (status: PaymentStatus): PaymentResult => ({
              paymentId: order.paymentId,
              razorpayPaymentId: status.razorpayPaymentId ?? '',
              type: params.type,
              bookings: status.bookingIds.map((id) => ({ id, status: 'BOOKED' })),
            });

            // Single exit for every path (handler, dismiss, failure,
            // resume check) — the first one wins.
            const settle = (result: PaymentResult | null) => {
              if (settled) return;
              settled = true;
              document.removeEventListener('visibilitychange', onResume);
              window.removeEventListener('pageshow', onResume);
              if (resumeTimer) clearTimeout(resumeTimer);
              setActiveCheckout(null);
              setProcessing(false);
              resolve(result);
            };

            // Server-side answer for this order. Settles only on a
            // definite outcome; "still pending" or "couldn't reach the
            // server" leave the checkout (and the stored record) alone.
            // Concurrent callers (resume + dismiss) share one request.
            let statusCheck: Promise<boolean> | null = null;
            const resolveFromServer = (): Promise<boolean> => {
              if (settled) return Promise.resolve(true);
              statusCheck ??= (async () => {
                const status = await fetchPaymentStatus(order.paymentId);
                if (settled || !status) return settled;
                if (status.state === 'fulfilled') {
                  clearPendingPayment(order.paymentId);
                  const successData = toResult(status);
                  options.onSuccess?.(successData);
                  // Settle before closing: close() fires ondismiss.
                  settle(successData);
                  try {
                    rzp?.close();
                  } catch {
                    /* modal already gone */
                  }
                  return true;
                }
                if (status.state === 'refunded') {
                  clearPendingPayment(order.paymentId);
                  options.onFailure?.(status.error || 'Your booking could not be completed and the payment was refunded.');
                  settle(null);
                  return true;
                }
                if (status.state === 'failed') clearPendingPayment(order.paymentId);
                return false;
              })().finally(() => {
                statusCheck = null;
              });
              return statusCheck;
            };

            // Back from the UPI app. Give Razorpay's own handler a moment
            // to fire first; if it hasn't, ask the server.
            const onResume = () => {
              if (settled || document.visibilityState !== 'visible') return;
              if (resumeTimer) clearTimeout(resumeTimer);
              resumeTimer = setTimeout(() => {
                if (!verifying) void resolveFromServer();
              }, 2500);
            };
            document.addEventListener('visibilitychange', onResume);
            window.addEventListener('pageshow', onResume);

            const rzpOptions: Record<string, unknown> = {
              key: order.keyId,
              amount: order.amount,
              currency: order.currency,
              // Merchant name shown in the Razorpay modal — use the center's
              // own name so a Toplay booking reads "Toplay", not "ABCA". Falls
              // back only when the server didn't supply a center name.
              name: order.centerName || 'PlayOrbit',
              description: params.description || (params.type === 'PACKAGE_PURCHASE' ? 'Package Purchase' : 'Slot Booking'),
              order_id: order.orderId,
              prefill: params.prefill || {},
              theme: {
                color: order.centerThemeColor || '#d4a843',
              },
              handler: async (response: {
                razorpay_order_id: string;
                razorpay_payment_id: string;
                razorpay_signature: string;
              }) => {
                verifying = true;
                // Step 3: Verify payment on our backend
                let verifyRes: Response;
                try {
                  verifyRes = await fetch('/api/payments/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_signature: response.razorpay_signature,
                      paymentId: order.paymentId,
                    }),
                  });
                } catch {
                  // The request never reached us — typically the page was
                  // backgrounded mid-flight. The money is taken, so don't
                  // report a failure: ask the server, and if it can't say
                  // yet, keep the record for the next resume / app open.
                  verifying = false;
                  if (await resolveFromServer()) return;
                  const pendingMsg =
                    params.type === 'PACKAGE_PURCHASE'
                      ? 'Payment received — activating your package. It will appear under My Packages shortly.'
                      : 'Payment received — confirming your booking. It will appear in My Bookings shortly.';
                  if (options.onPending) options.onPending(pendingMsg);
                  else options.onFailure?.(pendingMsg);
                  // Free the page but keep the stored record: the app-wide
                  // watcher picks it up on the next resume.
                  settle(null);
                  return;
                }

                // The server has seen the payment from here on; whatever
                // it says is the outcome, recovery included.
                clearPendingPayment(order.paymentId);
                try {
                  if (!verifyRes.ok) {
                    const err = await verifyRes.json();
                    throw new Error(err.error || 'Payment verification failed');
                  }

                  const result = await verifyRes.json();

                  // If verify route reports booking failure (payment captured but booking failed)
                  if (result.success === false && result.error) {
                    throw new Error(result.error);
                  }

                  const successData = {
                    paymentId: order.paymentId,
                    razorpayPaymentId: response.razorpay_payment_id,
                    type: params.type,
                    bookings: result.bookings || null,
                  };

                  // A resume check may have confirmed it first; report once.
                  if (!settled) options.onSuccess?.(successData);
                  settle(successData);
                } catch (err) {
                  const msg = err instanceof Error ? err.message : 'Verification failed';
                  if (!settled) options.onFailure?.(msg);
                  settle(null);
                } finally {
                  verifying = false;
                }
              },
              modal: {
                ondismiss: () => {
                  // Closing the modal right after paying in the UPI app
                  // (before Razorpay noticed) must not lose the booking.
                  if (verifying) return;
                  void resolveFromServer().then((done) => {
                    if (!done) settle(null);
                  });
                },
              },
            };

            rzp = new window.Razorpay(rzpOptions);
            // A failed attempt doesn't end the checkout: the modal stays
            // open for a retry, and `handler` / `ondismiss` settle it.
            // Settling here used to drop a successful retry on the floor.
            rzp.on('payment.failed', () => {
              options.onFailure?.('Payment failed. Please try again.');
            });
            rzp.open();
          },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Payment initiation failed';
        options.onFailure?.(msg);
        setProcessing(false);
        return null;
      }
    },
    [scriptLoaded, options],
  );

  return { initiatePayment, processing, scriptLoaded };
}
