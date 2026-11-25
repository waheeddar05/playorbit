import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Module mocks ────────────────────────────────────────────────────
const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('@/lib/api-client', () => ({
  api: { get: (...a: unknown[]) => apiGet(...a), post: (...a: unknown[]) => apiPost(...a) },
}));
vi.mock('next/navigation', () => ({ useRouter: () => stable.router }));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => stable.toast }));
// Hook return values are hoisted constants: the real providers hand out
// stable objects between refetches, and the page keys effects on them, so
// a fresh object per render would loop.
const stable = vi.hoisted(() => ({
  razorpay: { initiatePayment: () => Promise.resolve(null), processing: false },
  // Cash-only center, so a confirmed booking posts straight to the API.
  paymentConfig: {
    config: { paymentEnabled: false, slotPaymentRequired: false, cashPaymentEnabled: true, walletEnabled: false },
  },
  center: {
    currentCenter: { id: 'ctr_toplay', name: 'Toplay', bookingModel: 'RESOURCE_BASED' },
    centers: [],
    switchTo: () => {},
    refresh: () => {},
  },
  user: { user: { id: 'u1', name: 'Asha', isSuperAdmin: false, isFreeUser: false } },
  router: { push: () => {} },
  toast: { error: () => {}, success: () => {} },
}));
vi.mock('@/lib/useRazorpay', () => ({
  useRazorpay: () => stable.razorpay,
  usePaymentConfig: () => stable.paymentConfig,
}));
vi.mock('@/lib/center-context', () => ({ useCenter: () => stable.center }));
vi.mock('@/lib/current-user', () => ({ useCurrentUser: () => stable.user }));
vi.mock('@/components/shop/MarketplacePromoBanner', () => ({ MarketplacePromoBanner: () => null }));
vi.mock('@/components/ContactFooter', () => ({ ContactFooter: () => null }));

import ResourceSlotsPage from '../ResourceSlotsPage';

/**
 * The Sidearm Specialist / Coach pickers only offer people who work the
 * picked pitch (assigned to it, or unassigned). Mirrors planBooking, which
 * refuses an indoor-only specialist on natural turf.
 */

const NET = { id: 'n1', name: 'Net 1', type: 'NET' };
const TURF = { id: 't1', name: 'Natural Turf', type: 'TURF_WICKET' };
const people = [
  { userId: 'sainath', name: 'Sainath', pitchAssignments: ['INDOOR_ASTRO'] },
  { userId: 'praveen', name: 'Praveen', pitchAssignments: ['INDOOR_ASTRO', 'NATURAL_TURF'] },
  { userId: 'newbie', name: 'Newbie', pitchAssignments: [] },
];

function availability() {
  return {
    date: '2026-11-20',
    centerId: 'ctr_toplay',
    centerSlug: 'toplay',
    indoorNetsTotal: 1,
    outdoorResourcesTotal: 1,
    coachesTotal: 3,
    sidearmStaffTotal: 3,
    sidearmPitchTypes: ['ASTRO', 'NATURAL'],
    netPitchTypes: [],
    coachingPitchTypes: ['ASTRO', 'NATURAL'],
    enabledCategories: ['SIDEARM'],
    pricingConfig: {
      categoryRates: {
        MACHINE: { morning: 0, evening: 0 },
        SIDEARM: { morning: 500, evening: 500 },
        COACHING: { morning: 0, evening: 0 },
        FULL_COURT: { morning: 0, evening: 0 },
        FULL_OUTDOOR_COURT: { morning: 0, evening: 0 },
        CORPORATE_BATCH: { morning: 0, evening: 0 },
        NET: { morning: 0, evening: 0 },
      },
    },
    corporateBatchConfig: { enabled: false, days: [], startTime: '07:00', endTime: '09:00', netsConsumed: 0 },
    slots: [
      {
        startTime: '2026-11-20T03:30:00.000Z',
        endTime: '2026-11-20T04:00:00.000Z',
        timeSlab: 'morning' as const,
        freeIndoorNets: [NET],
        freeOutdoorResources: [TURF],
        freeByPitch: { ASTRO: [NET], CEMENT: [], NATURAL: [TURF] },
        freeCoaches: people,
        freeSidearmStaff: people,
        fullCourtAvailable: false,
        fullOutdoorCourtAvailable: false,
        corporateBatchHolds: 0,
        prices: { MACHINE: 0, SIDEARM: 500, COACHING: 0, FULL_COURT: 0, FULL_OUTDOOR_COURT: 0, NET: 0, CORPORATE_BATCH: 0 },
      },
    ],
  };
}

function setup() {
  apiGet.mockImplementation((url: string) => {
    if (url.startsWith('/api/slots/resource-availability')) return Promise.resolve(availability());
    return Promise.resolve([]);
  });
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) })));
  return render(<ResourceSlotsPage />);
}

function personButton(name: string) {
  return screen.queryByRole('button', { name: new RegExp(`^${name}`) });
}

describe('ResourceSlotsPage — sidearm specialist picker follows pitch assignment', () => {
  beforeEach(() => { apiGet.mockReset(); apiPost.mockReset(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('lists indoor and unassigned specialists on Astro', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /Astro/ }));
    expect(await screen.findByRole('button', { name: /^Sainath/ })).toBeInTheDocument();
    expect(personButton('Praveen')).toBeInTheDocument();
    expect(personButton('Newbie')).toBeInTheDocument();
  });

  it('drops indoor-only specialists on natural turf and lists turf ones first', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /Natural/ }));
    const praveen = await screen.findByRole('button', { name: /^Praveen/ });
    expect(personButton('Sainath')).not.toBeInTheDocument();
    expect(personButton('Newbie')).toBeInTheDocument();
    // Default pick is the turf-assigned specialist, not the unassigned one.
    await vi.waitFor(() => expect(praveen.className).toContain('bg-accent'));
  });
});
