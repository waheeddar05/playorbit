/**
 * useRazorpay when the customer leaves the app mid-checkout.
 *
 * The production symptom: pay in the UPI app, minimise PlayOrbit straight
 * away, come back — no booking until My Bookings is opened. Razorpay's
 * `handler` either never fires on the frozen page or its verify request
 * dies with the page. These pin the recovery paths.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRazorpay, type PaymentResult } from '../useRazorpay';
import { readPendingPayment, getActiveCheckout } from '../pending-payment';

type Opts = {
  handler: (r: Record<string, string>) => Promise<void>;
  modal: { ondismiss: () => void };
};

let rzpOpts: Opts;
const rzpHandlers: Record<string, () => void> = {};
const closeMock = vi.fn();

class FakeRazorpay {
  constructor(o: Opts) {
    rzpOpts = o;
  }
  open() {}
  close() {
    closeMock();
    // The real checkout fires ondismiss when closed programmatically.
    rzpOpts.modal.ondismiss();
  }
  on(event: string, h: () => void) {
    rzpHandlers[event] = h;
  }
}

const fetchMock = vi.fn();

function respond(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function routeFetch(routes: Record<string, () => Promise<Response>>) {
  fetchMock.mockImplementation((url: string) => {
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    if (!key) throw new Error(`unexpected fetch ${url}`);
    return routes[key]();
  });
}

const ORDER = {
  orderId: 'order_1',
  paymentId: 'pay_1',
  amount: 50000,
  currency: 'INR',
  keyId: 'rzp_test',
};

const fulfilled = {
  state: 'fulfilled',
  paymentId: 'pay_1',
  type: 'SLOT_BOOKING',
  razorpayPaymentId: 'pay_rzp',
  bookingIds: ['bk_1', 'bk_2'],
  userPackageId: null,
  error: null,
};

function setVisibility(v: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
  document.dispatchEvent(new Event('visibilitychange'));
}

async function startCheckout(opts: Parameters<typeof useRazorpay>[0] = {}) {
  const { result } = renderHook(() => useRazorpay(opts));
  await waitFor(() => expect(result.current.scriptLoaded).toBe(true));
  let promise!: Promise<PaymentResult | null>;
  await act(async () => {
    promise = result.current.initiatePayment({ type: 'SLOT_BOOKING', amount: 500 });
  });
  await waitFor(() => expect(rzpOpts).toBeDefined());
  // Wrapped: an async function returning the promise would await it.
  return { promise };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  rzpOpts = undefined as unknown as Opts;
  for (const k of Object.keys(rzpHandlers)) delete rzpHandlers[k];
  (window as unknown as { Razorpay: unknown }).Razorpay = FakeRazorpay;
  vi.stubGlobal('fetch', fetchMock);
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useRazorpay — app backgrounded after paying', () => {
  it('records the checkout so a reloaded page can still resolve it', async () => {
    routeFetch({ '/api/payments/create-order': () => respond(ORDER) });
    await startCheckout();
    expect(readPendingPayment()).toMatchObject({ paymentId: 'pay_1', type: 'SLOT_BOOKING' });
    expect(getActiveCheckout()).toBe('pay_1');
  });

  it('confirms the booking on return when Razorpay never called back', async () => {
    routeFetch({
      '/api/payments/create-order': () => respond(ORDER),
      '/api/payments/status': () => respond(fulfilled),
    });
    const onSuccess = vi.fn();
    const { promise } = await startCheckout({ onSuccess });

    vi.useFakeTimers();
    setVisibility('hidden');
    setVisibility('visible');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    vi.useRealTimers();

    const result = await promise;
    expect(result?.bookings).toHaveLength(2);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalled();
    expect(readPendingPayment()).toBeNull();
    expect(getActiveCheckout()).toBeNull();
  });

  it('leaves the checkout open while the payment is still pending', async () => {
    routeFetch({
      '/api/payments/create-order': () => respond(ORDER),
      '/api/payments/status': () => respond({ ...fulfilled, state: 'pending', bookingIds: [] }),
    });
    const { promise } = await startCheckout();
    let settled = false;
    void promise.then(() => (settled = true));

    vi.useFakeTimers();
    setVisibility('visible');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    vi.useRealTimers();

    expect(settled).toBe(false);
    expect(readPendingPayment()?.paymentId).toBe('pay_1');
  });

  it('does not report a failure when the verify request dies with the page', async () => {
    routeFetch({
      '/api/payments/create-order': () => respond(ORDER),
      '/api/payments/verify': () => Promise.reject(new TypeError('Failed to fetch')),
      '/api/payments/status': () => Promise.reject(new TypeError('Failed to fetch')),
    });
    const onFailure = vi.fn();
    const onPending = vi.fn();
    const { promise } = await startCheckout({ onFailure, onPending });

    await act(async () => {
      await rzpOpts.handler({
        razorpay_order_id: 'order_1',
        razorpay_payment_id: 'pay_rzp',
        razorpay_signature: 'sig',
      });
    });

    expect(await promise).toBeNull();
    expect(onFailure).not.toHaveBeenCalled();
    expect(onPending).toHaveBeenCalledWith(expect.stringContaining('Payment received'));
    // Kept for PendingPaymentWatcher to finish on the next resume.
    expect(readPendingPayment()?.paymentId).toBe('pay_1');
    expect(getActiveCheckout()).toBeNull();
  });

  it('turns a dropped verify into success when the server already booked it', async () => {
    routeFetch({
      '/api/payments/create-order': () => respond(ORDER),
      '/api/payments/verify': () => Promise.reject(new TypeError('Failed to fetch')),
      '/api/payments/status': () => respond(fulfilled),
    });
    const { promise } = await startCheckout();
    await act(async () => {
      await rzpOpts.handler({
        razorpay_order_id: 'order_1',
        razorpay_payment_id: 'pay_rzp',
        razorpay_signature: 'sig',
      });
    });
    expect((await promise)?.bookings).toHaveLength(2);
    expect(readPendingPayment()).toBeNull();
  });

  it('recovers a payment completed just before the modal was closed', async () => {
    routeFetch({
      '/api/payments/create-order': () => respond(ORDER),
      '/api/payments/status': () => respond(fulfilled),
    });
    const { promise } = await startCheckout();
    await act(async () => {
      rzpOpts.modal.ondismiss();
    });
    expect((await promise)?.bookings).toHaveLength(2);
  });

  it('a plain cancel still resolves null', async () => {
    routeFetch({
      '/api/payments/create-order': () => respond(ORDER),
      '/api/payments/status': () => respond({ ...fulfilled, state: 'pending', bookingIds: [] }),
    });
    const { promise } = await startCheckout();
    await act(async () => {
      rzpOpts.modal.ondismiss();
    });
    expect(await promise).toBeNull();
  });

  it('a failed attempt keeps the checkout open so a retry can succeed', async () => {
    routeFetch({
      '/api/payments/create-order': () => respond(ORDER),
      '/api/payments/verify': () => respond({ success: true, bookings: [{ id: 'bk_1', status: 'BOOKED' }] }),
    });
    const onFailure = vi.fn();
    const { promise } = await startCheckout({ onFailure });

    act(() => rzpHandlers['payment.failed']());
    expect(onFailure).toHaveBeenCalledWith('Payment failed. Please try again.');

    await act(async () => {
      await rzpOpts.handler({
        razorpay_order_id: 'order_1',
        razorpay_payment_id: 'pay_rzp',
        razorpay_signature: 'sig',
      });
    });
    expect((await promise)?.bookings).toEqual([{ id: 'bk_1', status: 'BOOKED' }]);
    expect(readPendingPayment()).toBeNull();
  });
});
