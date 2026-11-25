import { describe, it, expect, vi } from 'vitest';

/**
 * Pitch assignment drives who works a booking.
 *
 * Reported on TopPlay (2026-11-25): a natural-turf NET booking at 15:00 was
 * handed to Raj (rajendra brar), ground staff assigned to Indoor astro only,
 * because the picker took the highest-priority member on duty and ignored
 * pitch assignments. The turf ground staff (Vaibhav, priority 100) was on
 * duty and should have been picked.
 */

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/policy', () => ({
  getPolicyValue: vi.fn(),
  getPolicyJson: vi.fn(),
  getCenterOnlyPolicy: vi.fn(),
  getCenterOnlyPolicyJson: vi.fn(),
  isPolicyEnabled: vi.fn(),
}));

import { pickGroundStaffForSlot } from '../resource-booking';
import { getOperatorSlotCapacity, type OperatorRosterEntry } from '../operatorAssign';
import { memberServesPitch, rankStaffForPitch, staffPitchForBooking } from '../staff-pitch';

// 2026-11-25 is a Wednesday. 15:00–15:30 IST == 09:30–10:00 UTC.
const slot = {
  date: new Date('2026-11-25T00:00:00.000Z'),
  startTime: new Date('2026-11-25T09:30:00.000Z'),
  endTime: new Date('2026-11-25T10:00:00.000Z'),
};
const wed = (startTime: string, endTime: string) => [{ dayOfWeek: 3, startTime, endTime }];
const indoor = { pitchAssignments: ['INDOOR_ASTRO'] };
const turf = { pitchAssignments: ['NATURAL_TURF'] };

// TopPlay's active ground staff, in priority order, as on 2026-11-25.
const topPlayGroundStaff = [
  { userId: 'sainath', metadata: indoor, availability: wed('06:30', '11:00') },
  { userId: 'krushna', metadata: indoor, availability: wed('19:00', '23:00') },
  { userId: 'raj', metadata: indoor, availability: wed('06:00', '23:30') },
  { userId: 'playorbit', metadata: indoor, availability: [] },
  { userId: 'vaibhav', metadata: turf, availability: wed('06:00', '23:00') },
];

describe('staffPitchForBooking', () => {
  it('maps booking surfaces to staff pitches', () => {
    expect(staffPitchForBooking('NET', 'NATURAL')).toBe('NATURAL_TURF');
    expect(staffPitchForBooking('SIDEARM', 'NATURAL')).toBe('NATURAL_TURF');
    expect(staffPitchForBooking('MACHINE', 'ASTRO')).toBe('INDOOR_ASTRO');
    expect(staffPitchForBooking('FULL_OUTDOOR_COURT', null)).toBe('NATURAL_TURF');
    expect(staffPitchForBooking('FULL_OUTDOOR_COURT', 'ASTRO')).toBe('NATURAL_TURF');
    expect(staffPitchForBooking('FULL_COURT', null)).toBe('INDOOR_ASTRO');
    expect(staffPitchForBooking('CORPORATE_BATCH', null)).toBe('INDOOR_ASTRO');
    // No pitch on a net-pool category = the indoor NET pool.
    expect(staffPitchForBooking('NET', null)).toBe('INDOOR_ASTRO');
  });

  it('leaves surfaces with no staff assignment unconstrained', () => {
    expect(staffPitchForBooking('NET', 'CEMENT')).toBeNull();
    expect(staffPitchForBooking('MATCH_SIMULATION', null)).toBeNull();
  });
});

describe('memberServesPitch / rankStaffForPitch', () => {
  it('treats unassigned members as eligible everywhere', () => {
    expect(memberServesPitch(null, 'NATURAL_TURF')).toBe(true);
    expect(memberServesPitch({}, 'INDOOR_ASTRO')).toBe(true);
  });

  it('keeps assigned members to their pitches', () => {
    expect(memberServesPitch(indoor, 'NATURAL_TURF')).toBe(false);
    expect(memberServesPitch(indoor, 'INDOOR_ASTRO')).toBe(true);
    expect(memberServesPitch({ pitchAssignments: ['INDOOR_ASTRO', 'NATURAL_TURF'] }, 'NATURAL_TURF')).toBe(true);
    expect(memberServesPitch(indoor, null)).toBe(true);
  });

  it('ranks assigned members ahead of unassigned ones and drops the rest', () => {
    const members = [
      { userId: 'unassigned', metadata: null },
      { userId: 'indoor', metadata: indoor },
      { userId: 'turf', metadata: turf },
    ];
    expect(rankStaffForPitch(members, 'NATURAL_TURF').map((m) => m.userId)).toEqual(['turf', 'unassigned']);
    expect(rankStaffForPitch(members, 'INDOOR_ASTRO').map((m) => m.userId)).toEqual(['indoor', 'unassigned']);
    expect(rankStaffForPitch(members, null).map((m) => m.userId)).toEqual(['unassigned', 'indoor', 'turf']);
  });
});

describe('pickGroundStaffForSlot — pitch assignment', () => {
  it('gives the TopPlay natural-turf booking to turf staff, not Raj', () => {
    expect(pickGroundStaffForSlot(topPlayGroundStaff, slot, 'NATURAL_TURF')).toBe('vaibhav');
  });

  it('still gives an indoor booking to the top-priority indoor member on duty', () => {
    expect(pickGroundStaffForSlot(topPlayGroundStaff, slot, 'INDOOR_ASTRO')).toBe('raj');
  });

  it('falls back within the pitch pool when nobody there is scheduled', () => {
    const offDuty = topPlayGroundStaff.map((g) =>
      g.userId === 'vaibhav' ? { ...g, availability: wed('06:00', '07:00') } : g,
    );
    expect(pickGroundStaffForSlot(offDuty, slot, 'NATURAL_TURF')).toBe('vaibhav');
  });

  it('never hands a turf booking to indoor-only staff', () => {
    const indoorOnly = topPlayGroundStaff.filter((g) => g.userId !== 'vaibhav');
    expect(pickGroundStaffForSlot(indoorOnly, slot, 'NATURAL_TURF')).toBeNull();
  });

  it('uses unassigned staff for a pitch nobody is assigned to', () => {
    const withUnassigned = [...topPlayGroundStaff.filter((g) => g.userId !== 'vaibhav'), { userId: 'new', metadata: null, availability: [] }];
    expect(pickGroundStaffForSlot(withUnassigned, slot, 'NATURAL_TURF')).toBe('new');
  });

  it('keeps the old behaviour when the booking has no staff pitch', () => {
    expect(pickGroundStaffForSlot(topPlayGroundStaff, slot)).toBe('raj');
  });
});

describe('getOperatorSlotCapacity — pitch assignment', () => {
  const roster: OperatorRosterEntry[] = [
    { userId: 'indoor1', priority: 1, metadata: indoor, availability: wed('06:00', '23:00') },
    { userId: 'any', priority: 2, metadata: null, availability: wed('06:00', '23:00') },
    { userId: 'turf1', priority: 3, metadata: turf, availability: wed('06:00', '23:00') },
  ];
  const db = { booking: { findMany: vi.fn().mockResolvedValue([]) } };

  it('counts only operators who work the pitch, assigned ones first', async () => {
    const capacity = await getOperatorSlotCapacity({ centerId: 'c', slot, tx: db as never, roster, pitch: 'NATURAL_TURF' });
    expect(capacity.onDuty).toBe(2);
    expect(capacity.freeOperatorIds).toEqual(['turf1', 'any']);
  });

  it('is unchanged without a pitch', async () => {
    const capacity = await getOperatorSlotCapacity({ centerId: 'c', slot, tx: db as never, roster });
    expect(capacity.freeOperatorIds).toEqual(['indoor1', 'any', 'turf1']);
  });
});
