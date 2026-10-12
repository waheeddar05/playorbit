import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Full Outdoor Court — the outdoor twin of Full Indoor Court. Same flow,
 * pricing shape and block rules; the only difference is the pool: it
 * takes every natural-turf wicket (TURF_WICKET) and never an Astro net.
 * These tests pin that mapping on both sides and that the indoor court
 * is untouched by the new category.
 */

// planBooking reads resources / staff / bookings / blocks through Prisma
// and the reservation configs through the policy resolver. Both are
// mocked so the planner runs against in-memory fixtures.
const db = vi.hoisted(() => ({
  resources: [] as unknown[],
  bookings: [] as unknown[],
  blocks: [] as unknown[],
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    resource: { findMany: vi.fn(async () => db.resources) },
    centerMembership: { findMany: vi.fn(async () => []) },
    booking: { findMany: vi.fn(async () => db.bookings) },
    blockedSlot: { findMany: vi.fn(async () => db.blocks) },
  },
}));

vi.mock('@/lib/policy', () => ({
  getCenterOnlyPolicyJson: vi.fn(async (_key: string, _centerId: string, fallback: unknown) => fallback),
}));

import {
  applyBlocksToAvailability,
  computeSlotAvailability,
  evaluateBlockForBooking,
  naturalTurfWickets,
  planBooking,
  BookingResourceError,
  type ActiveBlock,
} from '../resource-booking';
import {
  DEFAULT_RESOURCE_PRICING,
  getResourceSlotPrice,
  type ResourcePricingConfig,
} from '../resource-pricing';
import { DEFAULT_TIME_SLABS } from '../pricing';
import { BOOKING_CATEGORIES, bookingCategoryLabel } from '../booking-categories';
import { ALL_BOOKABLE_CATEGORIES } from '../pitch-config';

// 2 indoor Astro nets, 1 cement wicket, 2 natural turf wickets.
const resources = [
  { id: 'net1', name: 'Net 1', type: 'NET', category: 'INDOOR', capacity: 1, isActive: true, displayOrder: 1 },
  { id: 'net2', name: 'Net 2', type: 'NET', category: 'INDOOR', capacity: 1, isActive: true, displayOrder: 2 },
  { id: 'cem1', name: 'Cement 1', type: 'CEMENT_WICKET', category: 'OUTDOOR', capacity: 1, isActive: true, displayOrder: 3 },
  { id: 'nat1', name: 'Natural 1', type: 'TURF_WICKET', category: 'OUTDOOR', capacity: 1, isActive: true, displayOrder: 4 },
  { id: 'nat2', name: 'Natural 2', type: 'TURF_WICKET', category: 'OUTDOOR', capacity: 1, isActive: true, displayOrder: 5 },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any[];

const occupancy = (
  over: Partial<{ load: Record<string, number>; fullCourt: boolean; fullOutdoorCourt: boolean }> = {},
) => ({
  resourceLoad: new Map<string, number>(Object.entries(over.load ?? {})),
  claimedResourceIds: new Set<string>(),
  busyCoachIds: new Set<string>(),
  busyStaffIds: new Set<string>(),
  busyMachineIds: new Set<string>(),
  hasFullCourtBooking: over.fullCourt ?? false,
  hasFullOutdoorCourtBooking: over.fullOutdoorCourt ?? false,
});

const avail = (o = occupancy(), reservedByPitch = {}) =>
  computeSlotAvailability({ resources, coaches: [], staff: [], occupancy: o, reservedByPitch });

const block = (over: Partial<ActiveBlock>): ActiveBlock => ({
  id: 'b', reason: null, appliesTo: 'ALL',
  machineRowIds: [], resourceIds: [], categories: [],
  pitchType: null, netCount: null,
  legacyMachineId: null, legacyMachineIds: [], legacyMachineType: null, legacyPitchType: null,
  ...over,
});

describe('naturalTurfWickets', () => {
  it('is every natural-turf wicket and nothing else', () => {
    expect(naturalTurfWickets(resources).map((r) => r.id)).toEqual(['nat1', 'nat2']);
  });
});

describe('computeSlotAvailability — full outdoor court', () => {
  it('is available when every natural wicket is free, whatever the indoor nets are doing', () => {
    const a = avail(occupancy({ load: { net1: 1, net2: 1, cem1: 1 } }));
    expect(a.fullOutdoorCourtAvailable).toBe(true);
    // The indoor court is unaffected by the outdoor rule…
    expect(a.fullCourtAvailable).toBe(false);
  });

  it('is unavailable while any natural wicket is in use', () => {
    const a = avail(occupancy({ load: { nat2: 1 } }));
    expect(a.fullOutdoorCourtAvailable).toBe(false);
    // …and the indoor court ignores natural wickets.
    expect(a.fullCourtAvailable).toBe(true);
  });

  it('is unavailable while a reservation holds a natural wicket', () => {
    expect(avail(occupancy(), { NATURAL: 1 }).fullOutdoorCourtAvailable).toBe(false);
    expect(avail(occupancy(), { ASTRO: 1 }).fullOutdoorCourtAvailable).toBe(true);
  });

  it('is unavailable at a center with no natural wickets', () => {
    const indoorOnly = resources.filter((r) => r.type === 'NET');
    const a = computeSlotAvailability({ resources: indoorOnly, coaches: [], staff: [], occupancy: occupancy() });
    expect(a.fullOutdoorCourtAvailable).toBe(false);
    expect(a.fullCourtAvailable).toBe(true);
  });

  it('a full-outdoor-court booking locks every natural wicket and only those', () => {
    const a = avail(occupancy({ fullOutdoorCourt: true }));
    expect(a.freeByPitch.NATURAL).toHaveLength(0);
    expect(a.freeByPitch.ASTRO).toHaveLength(2);
    expect(a.freeByPitch.CEMENT).toHaveLength(1);
    expect(a.fullOutdoorCourtAvailable).toBe(false);
    expect(a.fullCourtAvailable).toBe(true);
  });

  it('a full-indoor-court booking never touches the natural pool', () => {
    const a = avail(occupancy({ fullCourt: true }));
    expect(a.freeByPitch.ASTRO).toHaveLength(0);
    expect(a.freeByPitch.NATURAL).toHaveLength(2);
    expect(a.fullOutdoorCourtAvailable).toBe(true);
  });
});

describe('applyBlocksToAvailability — full outdoor court', () => {
  it('a FULL_OUTDOOR_COURT category block takes only the outdoor court off the board', () => {
    const r = applyBlocksToAvailability(avail(), [block({ categories: ['FULL_OUTDOOR_COURT'] })]);
    expect(r.availability.fullOutdoorCourtAvailable).toBe(false);
    expect(r.availability.fullCourtAvailable).toBe(true);
    expect(r.availability.freeByPitch.NATURAL).toHaveLength(2);
  });

  it('a FULL_COURT block leaves the outdoor court bookable', () => {
    const r = applyBlocksToAvailability(avail(), [block({ categories: ['FULL_COURT'] })]);
    expect(r.availability.fullCourtAvailable).toBe(false);
    expect(r.availability.fullOutdoorCourtAvailable).toBe(true);
  });

  it('a NATURAL pitch-only block blocks the outdoor court; an ASTRO one does not', () => {
    const natural = applyBlocksToAvailability(avail(), [block({ pitchType: 'NATURAL' })]);
    expect(natural.availability.fullOutdoorCourtAvailable).toBe(false);
    expect(natural.blockedByPitch.NATURAL.categories.has('FULL_OUTDOOR_COURT')).toBe(true);

    const astro = applyBlocksToAvailability(avail(), [block({ pitchType: 'ASTRO' })]);
    expect(astro.availability.fullOutdoorCourtAvailable).toBe(true);
  });

  it('a block pinning one natural wicket blocks the outdoor court', () => {
    const r = applyBlocksToAvailability(avail(), [block({ resourceIds: ['nat1'] })]);
    expect(r.availability.fullOutdoorCourtAvailable).toBe(false);
  });

  it('a catchall block blocks both courts', () => {
    const r = applyBlocksToAvailability(avail(), [block({})]);
    expect(r.availability.fullOutdoorCourtAvailable).toBe(false);
    expect(r.availability.fullCourtAvailable).toBe(false);
  });

  it('a category block on another category leaves it alone', () => {
    const r = applyBlocksToAvailability(avail(), [block({ categories: ['NET'], pitchType: 'NATURAL' })]);
    expect(r.availability.fullOutdoorCourtAvailable).toBe(true);
  });
});

describe('evaluateBlockForBooking — full outdoor court', () => {
  it('is matched by its own category, not by FULL_COURT', () => {
    const booking = { category: 'FULL_OUTDOOR_COURT' as const, resourceIds: ['nat1', 'nat2'], pitchType: 'NATURAL' };
    expect(evaluateBlockForBooking([block({ categories: ['FULL_OUTDOOR_COURT'] })], booking)).not.toBeNull();
    expect(evaluateBlockForBooking([block({ categories: ['FULL_COURT'] })], booking)).toBeNull();
  });
});

describe('planBooking — FULL_OUTDOOR_COURT', () => {
  const slot = {
    centerId: 'ctr_test',
    date: new Date('2026-07-06T00:00:00.000Z'),
    // 11:00–11:30 IST — outside any default reservation window.
    startTime: new Date('2026-07-06T05:30:00.000Z'),
    endTime: new Date('2026-07-06T06:00:00.000Z'),
  };
  const bookingOn = (category: string, resourceIds: string[]) => ({
    id: `b_${category}`,
    startTime: slot.startTime,
    endTime: slot.endTime,
    category,
    assignedMachineId: null,
    assignedCoachId: null,
    assignedStaffId: null,
    resourceAssignments: resourceIds.map((resourceId) => ({ resourceId })),
  });

  beforeEach(() => {
    db.resources = resources;
    db.bookings = [];
    db.blocks = [];
  });

  it('claims every natural wicket and no Astro net', async () => {
    const plan = await planBooking({ ...slot, category: 'FULL_OUTDOOR_COURT' });
    expect(plan.category).toBe('FULL_OUTDOOR_COURT');
    expect(plan.resourceIds.sort()).toEqual(['nat1', 'nat2']);
  });

  it('leaves the indoor court mapped to the Astro nets only', async () => {
    const plan = await planBooking({ ...slot, category: 'FULL_COURT' });
    expect(plan.resourceIds.sort()).toEqual(['net1', 'net2']);
  });

  it('is refused while a natural wicket is booked, but not while the indoor court is', async () => {
    db.bookings = [bookingOn('NET', ['nat1'])];
    await expect(planBooking({ ...slot, category: 'FULL_OUTDOOR_COURT' })).rejects.toBeInstanceOf(BookingResourceError);

    db.bookings = [bookingOn('FULL_COURT', ['net1', 'net2'])];
    await expect(planBooking({ ...slot, category: 'FULL_OUTDOOR_COURT' })).resolves.toMatchObject({
      resourceIds: ['nat1', 'nat2'],
    });
  });

  it('an existing outdoor court booking refuses natural-turf nets but not Astro ones', async () => {
    db.bookings = [bookingOn('FULL_OUTDOOR_COURT', ['nat1', 'nat2'])];
    await expect(
      planBooking({ ...slot, category: 'NET', pitchType: 'NATURAL' }),
    ).rejects.toBeInstanceOf(BookingResourceError);
    await expect(
      planBooking({ ...slot, category: 'NET', pitchType: 'ASTRO' }),
    ).resolves.toMatchObject({ category: 'NET' });
    await expect(planBooking({ ...slot, category: 'FULL_COURT' })).resolves.toMatchObject({
      category: 'FULL_COURT',
    });
  });

  it('is refused at a center with no natural wickets', async () => {
    db.resources = resources.filter((r) => r.type === 'NET');
    await expect(planBooking({ ...slot, category: 'FULL_OUTDOOR_COURT' })).rejects.toThrow(
      /No natural turf wickets/,
    );
  });

  it('honours a NATURAL pitch block even when the caller sent no pitch', async () => {
    db.blocks = [{
      id: 'blk', startTime: null, endTime: null, recurringDays: [], reason: 'Re-laying the square',
      appliesTo: 'ALL', machineRowIds: [], resourceIds: [], categories: [], netCount: null,
      machineId: null, machineIds: [], machineType: null, pitchType: 'NATURAL',
    }];
    await expect(planBooking({ ...slot, category: 'FULL_OUTDOOR_COURT' })).rejects.toThrow(
      /Re-laying the square/,
    );
    await expect(planBooking({ ...slot, category: 'FULL_COURT' })).resolves.toMatchObject({
      category: 'FULL_COURT',
    });
  });
});

describe('getResourceSlotPrice — FULL_OUTDOOR_COURT', () => {
  const MORNING = new Date('2026-06-12T08:00:00+05:30');
  const price = (pricingConfig: ResourcePricingConfig, isConsecutive = false) =>
    getResourceSlotPrice({
      category: 'FULL_OUTDOOR_COURT',
      startTime: MORNING,
      isConsecutive,
      pricingConfig,
      timeSlabConfig: DEFAULT_TIME_SLABS,
    });

  it('uses the pair-shaped outdoor rate, including the consecutive total', async () => {
    const cfg: ResourcePricingConfig = {
      ...DEFAULT_RESOURCE_PRICING,
      fullCourtRate: { morning: { single: 2000, consecutive: 3000 }, evening: { single: 2500, consecutive: 4000 } },
      fullOutdoorCourtRate: { morning: { single: 5000, consecutive: 8000 }, evening: { single: 6000, consecutive: 10000 } },
    };
    expect(await price(cfg)).toBe(5000);
    expect(await price(cfg, true)).toBe(4000);
  });

  it('charges the default — never ₹0 — for a config saved before the category existed', async () => {
    const legacy = {
      categoryRates: { ...DEFAULT_RESOURCE_PRICING.categoryRates, FULL_OUTDOOR_COURT: undefined },
    } as ResourcePricingConfig;
    expect(await price(legacy)).toBe(2400);
  });

  it('leaves the indoor court price alone', async () => {
    const cfg: ResourcePricingConfig = {
      ...DEFAULT_RESOURCE_PRICING,
      fullOutdoorCourtRate: { morning: { single: 9999, consecutive: 0 }, evening: { single: 9999, consecutive: 0 } },
    };
    expect(
      await getResourceSlotPrice({
        category: 'FULL_COURT', startTime: MORNING, pricingConfig: cfg, timeSlabConfig: DEFAULT_TIME_SLABS,
      }),
    ).toBe(2400);
  });
});

describe('category catalogue', () => {
  it('is a labelled, bookable category', () => {
    expect(BOOKING_CATEGORIES).toContain('FULL_OUTDOOR_COURT');
    expect(bookingCategoryLabel('FULL_OUTDOOR_COURT')).toBe('Full Outdoor Court');
    expect(ALL_BOOKABLE_CATEGORIES).toContain('FULL_OUTDOOR_COURT');
  });
});
