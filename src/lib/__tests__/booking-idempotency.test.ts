import { describe, it, expect } from 'vitest';
import { deterministicBookingId } from '@/lib/booking-idempotency';

describe('deterministicBookingId', () => {
  it('is stable for the same fulfilment key and slot index', () => {
    // This is the whole point: a replayed INSERT — whether replayed by
    // Prisma's Accelerate query retry, by the transaction retry loop, or
    // by a second fulfilment path (verify vs webhook vs reconcile) —
    // must land on the same primary key.
    const a = deterministicBookingId('cmu9pho8f000cdudq0lxunu30', 0);
    const b = deterministicBookingId('cmu9pho8f000cdudq0lxunu30', 0);
    expect(a).toBe(b);
  });

  it('differs per slot index so a multi-slot booking creates distinct rows', () => {
    const key = 'cmu9pho8f000cdudq0lxunu30';
    const ids = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => deterministicBookingId(key, i));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('differs per fulfilment key', () => {
    expect(deterministicBookingId('pay_a', 0)).not.toBe(deterministicBookingId('pay_b', 0));
  });

  it('has the same shape as a cuid: 25 lowercase alphanumerics', () => {
    for (const key of ['pay_a', 'req_0f3e', 'x', 'cmu9pho8f000cdudq0lxunu30']) {
      for (const i of [0, 7]) {
        const id = deterministicBookingId(key, i);
        expect(id).toMatch(/^[a-z][a-z0-9]{24}$/);
        expect(id).toHaveLength(25);
      }
    }
  });
});
