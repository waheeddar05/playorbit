import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ─── Mocks ──────────────────────────────────────────────────────────
// The session, the three tables the route touches, and the notifier.
// The policy is stubbed at its boundary so the real config normaliser
// still runs and "coming soon" means what it means everywhere else.

const productFindUniqueMock = vi.fn();
const addressFindFirstMock = vi.fn();
const preBookingUpsertMock = vi.fn();
const preBookingUpdateManyMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    marketplaceProduct: { findUnique: (a: unknown) => productFindUniqueMock(a) },
    userAddress: { findFirst: (a: unknown) => addressFindFirstMock(a) },
    marketplacePreBooking: {
      upsert: (a: unknown) => preBookingUpsertMock(a),
      updateMany: (a: unknown) => preBookingUpdateManyMock(a),
    },
  },
}));

const getAuthenticatedUserMock = vi.fn();
vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: (req: unknown) => getAuthenticatedUserMock(req),
}));

const getPolicyJsonMock = vi.fn();
vi.mock('@/lib/policy', () => ({
  getPolicyJson: (...args: unknown[]) => getPolicyJsonMock(...args),
}));

const notifyInfoMock = vi.fn();
vi.mock('@/lib/notifications', () => ({
  notifyInfo: (...args: unknown[]) => notifyInfoMock(...args),
}));

import { DELETE, POST } from './route';

const CREATED_AT = new Date('2026-09-22T10:00:00.000Z');

const req = (body?: unknown) =>
  ({
    url: 'http://localhost/api/shop/products/p1/prebook',
    json: async () => {
      if (body === undefined) throw new Error('no body');
      return body;
    },
  }) as unknown as NextRequest;

const ctx = { params: Promise.resolve({ id: 'p1' }) };

const ADDRESS = {
  fullName: 'Rahul Kale',
  phone: '9876543210',
  line1: '12 MG Road',
  line2: null,
  landmark: null,
  city: 'Pune',
  state: 'Maharashtra',
  pincode: '411001',
};

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({ id: 'usr_1' });
  productFindUniqueMock.mockResolvedValue({
    id: 'p1',
    name: 'KIS M&H 7000',
    price: 6500,
    isActive: true,
    sizes: ['SH'],
  });
  // No MARKETPLACE_CONFIG row → defaults (enabled, coming soon).
  getPolicyJsonMock.mockResolvedValue(null);
  addressFindFirstMock.mockResolvedValue(ADDRESS);
  preBookingUpsertMock.mockImplementation(async (args: { create: Record<string, unknown> }) => ({
    id: 'pb_1',
    productId: 'p1',
    quantity: args.create.quantity,
    size: args.create.size,
    unitPrice: args.create.unitPrice,
    status: 'PENDING',
    createdAt: CREATED_AT,
  }));
  preBookingUpdateManyMock.mockResolvedValue({ count: 1 });
  notifyInfoMock.mockResolvedValue({ notificationId: 'n_1' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/shop/products/[id]/prebook', () => {
  it('answers a JSON 401 when signed out so the product page can prompt a login', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    const res = await POST(req({ quantity: 1 }), ctx);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Please sign in to pre-book');
    expect(preBookingUpsertMock).not.toHaveBeenCalled();
  });

  it('answers 404 for an unpublished product', async () => {
    productFindUniqueMock.mockResolvedValue({ id: 'p1', name: 'x', price: 1, isActive: false, sizes: [] });
    expect((await POST(req({}), ctx)).status).toBe(404);
    expect(preBookingUpsertMock).not.toHaveBeenCalled();
  });

  it('answers 404 when the whole store is switched off', async () => {
    getPolicyJsonMock.mockResolvedValue({ enabled: false, comingSoon: true });
    expect((await POST(req({}), ctx)).status).toBe(404);
    expect(preBookingUpsertMock).not.toHaveBeenCalled();
  });

  it('refuses to pre-book once the store is selling from stock', async () => {
    getPolicyJsonMock.mockResolvedValue({ enabled: true, comingSoon: false });
    const res = await POST(req({ quantity: 1 }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/order instead/i);
    expect(preBookingUpsertMock).not.toHaveBeenCalled();
  });

  it('rejects a quantity outside 1..10 and a fractional one', async () => {
    for (const quantity of [0, 11, 2.5]) {
      expect((await POST(req({ quantity }), ctx)).status, String(quantity)).toBe(400);
    }
    expect(preBookingUpsertMock).not.toHaveBeenCalled();
  });

  it('rejects a size the product does not come in', async () => {
    const res = await POST(req({ quantity: 1, size: 'Harrow' }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Pick one of the listed sizes');
    expect(preBookingUpsertMock).not.toHaveBeenCalled();
  });

  it('defaults to one when the body is empty or unparseable', async () => {
    await POST(req(), ctx);
    expect(preBookingUpsertMock.mock.calls[0][0].create.quantity).toBe(1);
  });

  it('snapshots the product and the address instead of relying on the relations', async () => {
    await POST(req({ quantity: 2, size: 'SH' }), ctx);
    const args = preBookingUpsertMock.mock.calls[0][0];
    // Keyed on the composite unique, so tapping again revises the same
    // row rather than queuing a second bat...
    expect(args.where).toEqual({ productId_userId: { productId: 'p1', userId: 'usr_1' } });
    // ...and an update resets the status, which is what revives a row
    // the customer had cancelled.
    expect(args.update.status).toBe('PENDING');
    expect(args.create).toMatchObject({
      productId: 'p1',
      userId: 'usr_1',
      productName: 'KIS M&H 7000',
      unitPrice: 6500,
      quantity: 2,
      size: 'SH',
      contactName: 'Rahul Kale',
      contactPhone: '9876543210',
      status: 'PENDING',
    });
    expect(args.create.addressText).toContain('12 MG Road');
    expect(args.create.addressText).toContain('Pune, Maharashtra 411001');
  });

  it('still records the pre-booking when the customer has no saved address', async () => {
    addressFindFirstMock.mockResolvedValue(null);
    const res = await POST(req({ quantity: 1 }), ctx);
    expect(res.status).toBe(200);
    expect(preBookingUpsertMock.mock.calls[0][0].create).toMatchObject({
      contactName: null,
      contactPhone: null,
      addressText: null,
    });
  });

  it('tells the customer it landed, and says nothing about paying', async () => {
    await POST(req({ quantity: 2 }), ctx);
    expect(notifyInfoMock).toHaveBeenCalledTimes(1);
    const [userId, title, message] = notifyInfoMock.mock.calls[0];
    expect(userId).toBe('usr_1');
    expect(title).toBe('Pre-booking confirmed');
    expect(message).toContain('2 × KIS M&H 7000');
    expect(message).toMatch(/nothing to pay/i);
  });

  it('keeps the pre-booking when the notification fails — the row is already saved', async () => {
    notifyInfoMock.mockRejectedValue(new Error('whatsapp down'));
    const res = await POST(req({ quantity: 1 }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).preBooking.id).toBe('pb_1');
  });

  it('returns only the booking, with no payment or total to settle', async () => {
    const res = await POST(req({ quantity: 2 }), ctx);
    const body = await res.json();
    expect(Object.keys(body)).toEqual(['preBooking']);
    expect(Object.keys(body.preBooking).sort()).toEqual(
      ['createdAt', 'id', 'productId', 'quantity', 'size', 'status', 'unitPrice'].sort(),
    );
  });
});

describe('DELETE /api/shop/products/[id]/prebook', () => {
  it('requires a session', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    expect((await DELETE(req(), ctx)).status).toBe(401);
    expect(preBookingUpdateManyMock).not.toHaveBeenCalled();
  });

  it('cancels the caller’s own row rather than deleting it', async () => {
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ preBooking: null });
    expect(preBookingUpdateManyMock).toHaveBeenCalledWith({
      where: { productId: 'p1', userId: 'usr_1' },
      data: { status: 'CANCELLED' },
    });
  });

  it('is idempotent when there is nothing to cancel', async () => {
    preBookingUpdateManyMock.mockResolvedValue({ count: 0 });
    expect((await DELETE(req(), ctx)).status).toBe(200);
  });
});
