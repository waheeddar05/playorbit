import { describe, it, expect } from 'vitest';
import {
  MAX_SELF_OPERATE_ADJUSTMENT,
  applySelfOperateAdjustment,
  formatSelfOperateAdjustment,
  normalizeSelfOperateAdjustment,
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
