import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { format, parseISO } from 'date-fns';

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

// ── Fixtures ────────────────────────────────────────────────────────
const NET = { id: 'n1', name: 'Net 1', type: 'NET' };

/** A leather machine — operator-only before this change. */
const YANTRA = {
  id: 'm_yantra',
  name: 'Yantra 1',
  isActive: true,
  supportedPitchTypes: ['ASTRO'],
  supportedBallTypes: ['LEATHER'],
  effectivePitchTypes: ['ASTRO'],
  effectiveBallTypes: ['LEATHER'],
  machineType: { id: 'mt1', code: 'YANTRA', name: 'Yantra', ballType: 'LEATHER' },
  resource: null,
};

function slot(startTime: string, endTime: string, opts: { operatorFree: boolean }) {
  return {
    startTime,
    endTime,
    timeSlab: 'morning' as const,
    freeIndoorNets: [NET],
    freeOutdoorResources: [],
    freeByPitch: { ASTRO: [NET], CEMENT: [], NATURAL: [] },
    freeCoaches: [],
    freeSidearmStaff: [],
    fullCourtAvailable: true,
    fullOutdoorCourtAvailable: false,
    corporateBatchHolds: 0,
    prices: { MACHINE: 600, SIDEARM: 0, COACHING: 0, FULL_COURT: 0, FULL_OUTDOOR_COURT: 0, NET: 0, CORPORATE_BATCH: 0 },
    // operatorFree=false is the "only available for self-operate" slot:
    // nobody on duty, so the grid labels it Self Operate.
    operatorCount: opts.operatorFree ? 1 : 0,
    operatorsBusy: 0,
    operatorAvailable: opts.operatorFree,
    selfOperate: !opts.operatorFree,
  };
}

// 09:00–09:30 has an operator; 10:00–10:30 has none (not back-to-back,
// so no consecutive pricing muddies the numbers).
const WITH_OPERATOR_SLOT = slot('2026-11-20T03:30:00.000Z', '2026-11-20T04:00:00.000Z', { operatorFree: true });
const SELF_ONLY_SLOT = slot('2026-11-20T04:30:00.000Z', '2026-11-20T05:00:00.000Z', { operatorFree: false });

function availability(pricingExtra: Record<string, unknown>) {
  return {
    date: '2026-11-20',
    centerId: 'ctr_toplay',
    centerSlug: 'toplay',
    indoorNetsTotal: 1,
    outdoorResourcesTotal: 0,
    coachesTotal: 0,
    sidearmStaffTotal: 0,
    sidearmPitchTypes: [],
    netPitchTypes: [],
    enabledCategories: ['MACHINE'],
    pricingConfig: {
      categoryRates: {
        MACHINE: { morning: 600, evening: 800 },
        SIDEARM: { morning: 0, evening: 0 },
        COACHING: { morning: 0, evening: 0 },
        FULL_COURT: { morning: 0, evening: 0 },
        FULL_OUTDOOR_COURT: { morning: 0, evening: 0 },
        CORPORATE_BATCH: { morning: 0, evening: 0 },
        NET: { morning: 0, evening: 0 },
      },
      ...pricingExtra,
    },
    corporateBatchConfig: { enabled: false, days: [], startTime: '07:00', endTime: '09:00', netsConsumed: 0 },
    slots: [WITH_OPERATOR_SLOT, SELF_ONLY_SLOT],
  };
}

function setup(pricingExtra: Record<string, unknown>) {
  apiGet.mockImplementation((url: string) => {
    if (url.startsWith('/api/slots/resource-availability')) return Promise.resolve(availability(pricingExtra));
    return Promise.resolve([]);
  });
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    const body = String(url).includes('/machines') ? [YANTRA] : {};
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  }));
  return render(<ResourceSlotsPage />);
}

/** The slot-card button for a fixture slot. The page formats times in
 *  the runner's local timezone, so derive the label the same way. */
async function card(s: { startTime: string }) {
  const label = format(parseISO(s.startTime), 'HH:mm');
  const time = await screen.findByText(new RegExp(`^${label} –`));
  return time.closest('button') as HTMLButtonElement;
}

/** The operation-mode toggle (the grid card also says "Self Operate"). */
function toggle() {
  return screen.findByRole('button', { name: /^Self Operate/ });
}

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ResourceSlotsPage — self operate', () => {
  it('offers Self Operate on a leather machine and promotes the saving on the button', async () => {
    setup({ selfOperateAdjustment: -100 });
    const button = await toggle();
    expect(within(button).getByText(/₹100 off/)).toBeInTheDocument();
    expect(await screen.findByText(/get ₹100 off every slot/)).toBeInTheDocument();
  });

  it('prices a self-operate-only slot with the adjustment (the reported bug)', async () => {
    setup({ selfOperateAdjustment: -100 });
    await toggle(); // machine loaded + auto-selected
    const selfOnly = await card(SELF_ONLY_SLOT);
    // Discounted price, operator rate struck through, saving badge.
    expect(within(selfOnly).getByText('Self Operate')).toBeInTheDocument();
    expect(within(selfOnly).getByText('₹600')).toHaveClass('line-through');
    expect(within(selfOnly).getByText(/₹500/)).toBeInTheDocument();
    expect(within(selfOnly).getByText('Self operate: ₹100 off')).toBeInTheDocument();

    // The slot with a free operator keeps the operator rate.
    const withOperator = await card(WITH_OPERATOR_SLOT);
    expect(within(withOperator).queryByText(/off/)).not.toBeInTheDocument();
    expect(within(withOperator).getByText(/₹600/)).toBeInTheDocument();

    // Selecting it carries the discounted price into the booking bar.
    fireEvent.click(selfOnly);
    expect(await screen.findByText('500')).toBeInTheDocument();
    expect(screen.getByText(/incl\. Self Operate: -₹100/)).toBeInTheDocument();
  });

  it('applies the adjustment to every slot once the player picks Self Operate', async () => {
    setup({ selfOperateAdjustment: -100 });
    fireEvent.click(await toggle());
    const withOperator = await card(WITH_OPERATOR_SLOT);
    expect(within(withOperator).getByText('Self operate: ₹100 off')).toBeInTheDocument();
    expect(within(withOperator).getByText('₹600')).toHaveClass('line-through');
  });

  it('uses the per-machine amount over the center default', async () => {
    setup({ selfOperateAdjustment: -100, selfOperateMachines: { m_yantra: { adjustment: -50 } } });
    await toggle(); // machine loaded + auto-selected
    const selfOnly = await card(SELF_ONLY_SLOT);
    expect(within(selfOnly).getByText('Self operate: ₹50 off')).toBeInTheDocument();
    expect(within(selfOnly).getByText(/₹550/)).toBeInTheDocument();
  });

  it('treats an operator-only machine as before: no toggle, no self-operate slots', async () => {
    setup({ selfOperateAdjustment: -100, selfOperateMachines: { m_yantra: { enabled: false } } });
    // Wait for the machine list to load and auto-select the Yantra.
    const reason = await screen.findByText(/requires an operator/);
    const selfOnly = await card(SELF_ONLY_SLOT);
    expect(selfOnly).toContainElement(reason);
    expect(selfOnly).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Self Operate/ })).not.toBeInTheDocument();
  });

  it('shows a self-operate-only slot at the plain rate when no adjustment is configured', async () => {
    setup({});
    await toggle(); // machine loaded + auto-selected
    const selfOnly = await card(SELF_ONLY_SLOT);
    expect(within(selfOnly).getByText('Self Operate')).toBeInTheDocument();
    expect(within(selfOnly).queryByText(/off/)).not.toBeInTheDocument();
    expect(within(selfOnly).getByText(/₹600/)).toBeInTheDocument();
  });

  it('sends the effective operation mode with the booking', async () => {
    apiPost.mockResolvedValue({ bookings: [{ id: 'b1' }] });
    setup({ selfOperateAdjustment: -100 });
    fireEvent.click(await toggle());
    fireEvent.click(await card(WITH_OPERATOR_SLOT));
    fireEvent.click(await screen.findByRole('button', { name: /^Confirm$/ }));
    const confirm = await screen.findByRole('button', { name: /Confirm Booking/ });
    expect(screen.getByText(/Self operate: ₹100 off \(1 slot, included\)/)).toBeInTheDocument();
    fireEvent.click(confirm);
    await vi.waitFor(() => expect(apiPost).toHaveBeenCalled());
    const [, body] = apiPost.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.operationMode).toBe('SELF_OPERATE');
    expect(body.machineId).toBe('m_yantra');
  });
});
