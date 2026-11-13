/**
 * Self-operate price adjustment.
 *
 * A signed ₹ amount per slot that a RESOURCE_BASED center adds to a
 * bowling-machine booking when the player picks **Self Operate** (runs
 * the machine themselves, no operator assigned). Negative = cheaper
 * (the usual case: "self-operate −₹100"), positive = a surcharge.
 *
 * Stored as `selfOperateAdjustment` on the center's
 * `RESOURCE_PRICING_CONFIG` policy and edited on Admin → Settings →
 * pricing. Pure module (no Prisma) so the admin editor, the slot page
 * and the booking route all share one normalizer and one rule — the
 * price the player is shown is the price the server records.
 *
 * Applies only when the player explicitly picked self-operate and the
 * server honoured it (never on a LEATHER machine, which always needs an
 * operator). The automatic fallback to self-operate when no operator is
 * on duty is decided inside the booking transaction, after the player
 * has already been quoted, so it keeps the normal rate.
 */

/** Largest adjustment, either sign, an admin can save. Far above any
 *  real slot price; exists only to stop a typo becoming a ₹10-lakh slot. */
export const MAX_SELF_OPERATE_ADJUSTMENT = 10000;

/**
 * Coerce whatever is stored (hand-editable policy JSON) to a whole-rupee
 * signed integer within ±MAX. Anything unusable reads as 0 = no
 * adjustment. Numeric strings are accepted.
 */
export function normalizeSelfOperateAdjustment(raw: unknown): number {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  const whole = Math.trunc(n);
  if (whole > MAX_SELF_OPERATE_ADJUSTMENT) return MAX_SELF_OPERATE_ADJUSTMENT;
  if (whole < -MAX_SELF_OPERATE_ADJUSTMENT) return -MAX_SELF_OPERATE_ADJUSTMENT;
  // Normalise -0 to 0 so it never renders as "−₹0".
  return whole === 0 ? 0 : whole;
}

/**
 * Apply the adjustment to one slot's base rate. The result never goes
 * below ₹0, so the delta actually applied can be smaller in magnitude
 * than the configured adjustment — callers persist `applied`, not the
 * configured value, so the booking row decomposes exactly:
 * `originalPrice = rate + applied`.
 */
export function applySelfOperateAdjustment(
  rate: number,
  adjustment: number,
): { price: number; applied: number } {
  const adj = normalizeSelfOperateAdjustment(adjustment);
  if (adj === 0 || !Number.isFinite(rate)) return { price: rate, applied: 0 };
  const price = Math.max(0, rate + adj);
  return { price, applied: price - rate };
}

/** "−₹100" / "+₹100" for labels; empty string for 0. */
export function formatSelfOperateAdjustment(amount: number | null | undefined): string {
  const n = normalizeSelfOperateAdjustment(amount);
  if (n === 0) return '';
  return `${n < 0 ? '−' : '+'}₹${Math.abs(n)}`;
}
