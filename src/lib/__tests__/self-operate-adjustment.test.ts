import { describe, it, expect } from 'vitest';
import {
  MAX_SELF_OPERATE_ADJUSTMENT,
  applySelfOperateAdjustment,
  formatSelfOperateAdjustment,
  isSelfOperateAllowed,
  normalizeSelfOperateAdjustment,
  normalizeSelfOperateMachines,
  resolveSelfOperateAdjustment,
  selfOperateBadgeLabel,
} from '@/lib/self-operate-adjustment';

describe('normalizeSelfOperateAdjustment', () => {
  it('keeps signed whole rupees', () => {
    expect(normalizeSelfOperateAdjustment(-100)).toBe(-100);
    expect(normalizeSelfOperateAdjustment(150)).toBe(150);
  });

  it('truncates fractions toward zero', () => {
    expect(normalizeSelfOperateAdjustment(-99.9)).toBe(-99);
    expect(normalizeSelfOperateAdjustment(49.5)).toBe(49);
  });

  it('accepts numeric strings from hand-edited policy JSON', () => {
    expect(normalizeSelfOperateAdjustment('-100')).toBe(-100);
    expect(normalizeSelfOperateAdjustment(' 75 ')).toBe(75);
  });

  it('reads anything unusable as no adjustment', () => {
    for (const raw of [undefined, null, '', '  ', 'abc', NaN, Infinity, -Infinity, {}, [], true]) {
      expect(normalizeSelfOperateAdjustment(raw)).toBe(0);
    }
  });

  it('never returns -0', () => {
    expect(Object.is(normalizeSelfOperateAdjustment(-0), 0)).toBe(true);
    expect(Object.is(normalizeSelfOperateAdjustment(-0.4), 0)).toBe(true);
  });

  it('clamps to ±MAX', () => {
    expect(normalizeSelfOperateAdjustment(1e9)).toBe(MAX_SELF_OPERATE_ADJUSTMENT);
    expect(normalizeSelfOperateAdjustment(-1e9)).toBe(-MAX_SELF_OPERATE_ADJUSTMENT);
  });
});

describe('applySelfOperateAdjustment', () => {
  it('reduces the rate by a negative adjustment', () => {
    expect(applySelfOperateAdjustment(600, -100)).toEqual({ price: 500, applied: -100 });
  });

  it('adds a positive surcharge', () => {
    expect(applySelfOperateAdjustment(600, 100)).toEqual({ price: 700, applied: 100 });
  });

  it('is a no-op at 0', () => {
    expect(applySelfOperateAdjustment(600, 0)).toEqual({ price: 600, applied: 0 });
  });

  it('works on a consecutive per-slot half rate', () => {
    // 2-slot pair total 1100 → 550/slot; −100 each.
    expect(applySelfOperateAdjustment(550, -100)).toEqual({ price: 450, applied: -100 });
  });

  it('never prices below ₹0 and reports only the delta actually applied', () => {
    const r = applySelfOperateAdjustment(80, -100);
    expect(r).toEqual({ price: 0, applied: -80 });
    // originalPrice decomposes exactly: rate + applied === price.
    expect(80 + r.applied).toBe(r.price);
  });

  it('normalizes the adjustment it is given', () => {
    expect(applySelfOperateAdjustment(600, -100.7)).toEqual({ price: 500, applied: -100 });
  });
});

describe('formatSelfOperateAdjustment', () => {
  it('signs the amount', () => {
    expect(formatSelfOperateAdjustment(-100)).toBe('−₹100');
    expect(formatSelfOperateAdjustment(50)).toBe('+₹50');
  });

  it('is empty for none', () => {
    expect(formatSelfOperateAdjustment(0)).toBe('');
    expect(formatSelfOperateAdjustment(null)).toBe('');
    expect(formatSelfOperateAdjustment(undefined)).toBe('');
  });
});

describe('normalizeSelfOperateMachines', () => {
  it('keeps enabled flags and numeric overrides', () => {
    expect(
      normalizeSelfOperateMachines({
        m1: { enabled: false },
        m2: { adjustment: -50 },
        m3: { enabled: 'true', adjustment: '0' },
      }),
    ).toEqual({
      m1: { enabled: false },
      m2: { adjustment: -50 },
      m3: { enabled: true, adjustment: 0 },
    });
  });

  it('drops malformed entries and unusable amounts', () => {
    expect(
      normalizeSelfOperateMachines({
        bad: 'x',
        arr: [1],
        empty: {},
        noAmount: { adjustment: 'abc' },
        nullAmount: { adjustment: null },
      }),
    ).toEqual({});
    expect(normalizeSelfOperateMachines(null)).toEqual({});
    expect(normalizeSelfOperateMachines([])).toEqual({});
  });
});

describe('isSelfOperateAllowed', () => {
  it('allows every machine by default, leather included', () => {
    expect(isSelfOperateAllowed({}, 'leather-machine')).toBe(true);
    expect(isSelfOperateAllowed(undefined, 'm1')).toBe(true);
  });

  it('honours an operator-only machine', () => {
    const cfg = { selfOperateMachines: { m1: { enabled: false } } };
    expect(isSelfOperateAllowed(cfg, 'm1')).toBe(false);
    expect(isSelfOperateAllowed(cfg, 'm2')).toBe(true);
  });

  it('treats an unidentified machine as allowed', () => {
    expect(isSelfOperateAllowed({ selfOperateMachines: { m1: { enabled: false } } }, null)).toBe(true);
  });
});

describe('resolveSelfOperateAdjustment', () => {
  const cfg = {
    selfOperateAdjustment: -100,
    selfOperateMachines: {
      yantra: { adjustment: -150 },
      gravity: { adjustment: 0 },
      leverage: {},
      off: { enabled: false, adjustment: -200 },
    },
  };

  it('uses the center default when a machine has no override', () => {
    expect(resolveSelfOperateAdjustment(cfg, 'leverage')).toBe(-100);
    expect(resolveSelfOperateAdjustment(cfg, 'unknown')).toBe(-100);
    expect(resolveSelfOperateAdjustment(cfg, null)).toBe(-100);
  });

  it('prefers the machine override, including an explicit 0', () => {
    expect(resolveSelfOperateAdjustment(cfg, 'yantra')).toBe(-150);
    expect(resolveSelfOperateAdjustment(cfg, 'gravity')).toBe(0);
  });

  it('is 0 for an operator-only machine', () => {
    expect(resolveSelfOperateAdjustment(cfg, 'off')).toBe(0);
  });

  it('is 0 when nothing is configured', () => {
    expect(resolveSelfOperateAdjustment({}, 'm1')).toBe(0);
  });
});

describe('selfOperateBadgeLabel', () => {
  it('reads as a deal for a reduction and a surcharge otherwise', () => {
    expect(selfOperateBadgeLabel(-100)).toBe('₹100 off');
    expect(selfOperateBadgeLabel(50)).toBe('+₹50');
    expect(selfOperateBadgeLabel(0)).toBe('');
  });
});
