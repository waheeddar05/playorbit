import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Coaches and sidearm specialists are pitch-scoped too: planBooking only
 * gives a COACHING / SIDEARM booking to someone assigned to the booking's
 * pitch, or with no assignment. The booking page lists the same set
 * (resource-availability returns pitchAssignments); this pins the server.
 */

const db = vi.hoisted(() => ({
  memberships: {} as Record<string, unknown[]>,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    resource: {
      findMany: vi.fn(async () => [
        { id: 'net1', name: 'Net 1', type: 'NET', category: 'INDOOR', capacity: 1, isActive: true, displayOrder: 1 },
        { id: 'nat1', name: 'Natural 1', type: 'TURF_WICKET', category: 'OUTDOOR', capacity: 1, isActive: true, displayOrder: 2 },
      ]),
    },
    centerMembership: {
      findMany: vi.fn(async (args: { where: { role: string } }) => db.memberships[args.where.role] ?? []),
    },
    booking: { findMany: vi.fn(async () => []) },
    blockedSlot: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock('@/lib/policy', () => ({
  getCenterOnlyPolicyJson: vi.fn(async (_key: string, _centerId: string, fallback: unknown) => fallback),
}));

import { planBooking, BookingResourceError } from '../resource-booking';

// Wed 2026-11-25, 15:00–15:30 IST.
const slot = {
  centerId: 'topplay',
  date: new Date('2026-11-25T00:00:00.000Z'),
  startTime: new Date('2026-11-25T09:30:00.000Z'),
  endTime: new Date('2026-11-25T10:00:00.000Z'),
};
const allDayWed = [{ dayOfWeek: 3, startTime: '06:00', endTime: '23:30', effectiveFrom: null, effectiveTo: null }];
const member = (userId: string, priority: number, pitchAssignments?: string[]) => ({
  userId,
  priority,
  metadata: pitchAssignments ? { pitchAssignments } : null,
  availability: allDayWed,
  user: { id: userId, name: userId, mobileNumber: null, email: null },
});

describe('planBooking — coach / sidearm pitch assignment', () => {
  beforeEach(() => {
    db.memberships = {
      // Mirrors TopPlay: indoor-only staff at the top of the priority
      // order, one specialist / coach who works both.
      SIDEARM_SPECIALIST: [member('sainath', 1, ['INDOOR_ASTRO']), member('praveen', 2, ['INDOOR_ASTRO', 'NATURAL_TURF'])],
      COACH: [member('raj', 1, ['INDOOR_ASTRO']), member('adinath', 2, ['INDOOR_ASTRO', 'NATURAL_TURF'])],
    };
  });

  it('auto-picks a turf specialist for a natural-turf sidearm booking', async () => {
    const plan = await planBooking({ ...slot, category: 'SIDEARM', pitchType: 'NATURAL' });
    expect(plan.staffId).toBe('praveen');
    expect(plan.resourceIds).toEqual(['nat1']);
  });

  it('auto-picks a turf coach for a natural-turf coaching booking', async () => {
    const plan = await planBooking({ ...slot, category: 'COACHING', pitchType: 'NATURAL' });
    expect(plan.coachId).toBe('adinath');
  });

  it('refuses a pinned indoor-only specialist / coach on natural turf', async () => {
    await expect(
      planBooking({ ...slot, category: 'SIDEARM', pitchType: 'NATURAL', staffId: 'sainath' }),
    ).rejects.toThrow(/does not work on this pitch/);
    await expect(
      planBooking({ ...slot, category: 'COACHING', pitchType: 'NATURAL', coachId: 'raj' }),
    ).rejects.toThrow(/does not work on this pitch/);
  });

  it('still lets indoor bookings go to indoor staff', async () => {
    await expect(planBooking({ ...slot, category: 'SIDEARM', pitchType: 'ASTRO' })).resolves.toMatchObject({ staffId: 'sainath' });
    await expect(
      planBooking({ ...slot, category: 'COACHING', pitchType: 'ASTRO', coachId: 'raj' }),
    ).resolves.toMatchObject({ coachId: 'raj' });
  });

  it('refuses when nobody free works the pitch', async () => {
    db.memberships.SIDEARM_SPECIALIST = [member('sainath', 1, ['INDOOR_ASTRO'])];
    await expect(planBooking({ ...slot, category: 'SIDEARM', pitchType: 'NATURAL' })).rejects.toBeInstanceOf(
      BookingResourceError,
    );
  });

  it('treats unassigned staff as working every pitch', async () => {
    db.memberships.COACH = [member('raj', 1, ['INDOOR_ASTRO']), member('newcoach', 2)];
    await expect(planBooking({ ...slot, category: 'COACHING', pitchType: 'NATURAL' })).resolves.toMatchObject({
      coachId: 'newcoach',
    });
  });
});
