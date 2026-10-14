/**
 * @vitest-environment node
 *
 * GET /api/payments/status — what the app asks when it comes back to the
 * foreground with a checkout unresolved. It must book a paid-but-unverified
 * payment there and then, and never act on someone else's payment.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const paymentFindUniqueMock = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      findUnique: (args: unknown) => paymentFindUniqueMock(args),
    },
  },
}));

const getAuthenticatedUserMock = vi.fn();
vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: (req: unknown) => getAuthenticatedUserMock(req),
}));

const reconcileMock = vi.fn();
vi.mock('@/lib/payment-reconcile', () => ({
  reconcileStalePayments: (opts: unknown) => reconcileMock(opts),
}));

import type { NextRequest } from 'next/server';
import { GET } from '../status/route';

const req = (paymentId?: string) =>
  ({
    nextUrl: new URL(`https://www.playorbit.in/api/payments/status${paymentId ? `?paymentId=${paymentId}` : ''}`),
  }) as unknown as NextRequest;

const row = (over: Record<string, unknown> = {}) => ({
  id: 'pay_1',
  userId: 'usr_1',
  status: 'CREATED',
  paymentType: 'SLOT_BOOKING',
  bookingIds: [] as string[],
  userPackageId: null,
  razorpayPaymentId: null,
  failureReason: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({ id: 'usr_1' });
  reconcileMock.mockResolvedValue({});
});

describe('GET /api/payments/status', () => {
  it('books a paid order the verify call never reached, and reports it fulfilled', async () => {
    paymentFindUniqueMock
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ status: 'CAPTURED', bookingIds: ['bk_1'], razorpayPaymentId: 'pay_rzp' }));

    const res = await GET(req('pay_1'));

    expect(reconcileMock).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'pay_1', minAgeMs: 0 }),
    );
    expect(await res.json()).toMatchObject({
      state: 'fulfilled',
      bookingIds: ['bk_1'],
      razorpayPaymentId: 'pay_rzp',
    });
  });

  it('reports pending when Razorpay has no capture yet', async () => {
    paymentFindUniqueMock.mockResolvedValue(row());
    const res = await GET(req('pay_1'));
    expect(await res.json()).toMatchObject({ state: 'pending' });
  });

  it('does not touch Razorpay for a payment that is already booked', async () => {
    paymentFindUniqueMock.mockResolvedValue(row({ status: 'CAPTURED', bookingIds: ['bk_1'] }));
    const res = await GET(req('pay_1'));
    expect(reconcileMock).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ state: 'fulfilled' });
  });

  it('reports a refund with its reason', async () => {
    paymentFindUniqueMock.mockResolvedValue(row({ status: 'REFUNDED', failureReason: 'Slot taken' }));
    const res = await GET(req('pay_1'));
    expect(reconcileMock).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ state: 'refunded', error: 'Slot taken' });
  });

  it("refuses another user's payment without reconciling it", async () => {
    paymentFindUniqueMock.mockResolvedValue(row({ userId: 'usr_other' }));
    const res = await GET(req('pay_1'));
    expect(res.status).toBe(404);
    expect(reconcileMock).not.toHaveBeenCalled();
  });

  it('requires sign-in and a paymentId', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce(null);
    expect((await GET(req('pay_1'))).status).toBe(401);
    expect((await GET(req())).status).toBe(400);
  });

  it('still answers when the reconcile throws', async () => {
    paymentFindUniqueMock.mockResolvedValue(row());
    reconcileMock.mockRejectedValueOnce(new Error('razorpay down'));
    const res = await GET(req('pay_1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ state: 'pending' });
  });
});
