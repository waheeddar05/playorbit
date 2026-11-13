/**
 * Self-operate: which machines a player may run themselves, and the
 * price adjustment for doing so.
 *
 * Both live on the center's `RESOURCE_PRICING_CONFIG` policy and are
 * edited on Admin → Settings → pricing:
 *
 *   selfOperateAdjustment  signed ₹ per slot, the center default
 *                          (−100 = ₹100 cheaper, +100 = surcharge)
 *   selfOperateMachines    per Machine row (keyed by Machine.id):
 *                          { enabled?: boolean, adjustment?: number | null }
 *                          — `enabled: false` makes that machine
 *                          operator-only; a numeric `adjustment`
 *                          overrides the center default for it.
 *
 * **Every machine allows self-operate unless switched off**, leather
 * included. A machine that allows it shows the Self Operate option and,
 * when no operator is free for a slot, falls back to self-operate
 * instead of going Not Available. A machine switched off always needs
 * an operator: Not Available when none is free, and a Self Operate pick
 * is ignored.
 *
 * The adjustment applies to every slot that is **booked as
 * self-operate** — whether the player picked it or the slot had no
 * operator free — so the grid's "Self Operate" slots are priced the
 * same as an explicit pick. It is part of the slot's rate (before
 * recurring / promo discounts), never takes a slot below ₹0, and is
 * skipped for package redemptions and free bookings.
 *
 * Pure module (no Prisma) shared by the admin editor, the slot page and
 * `/api/slots/book-resource`, so the price the player is shown is the
 * price the server records.
 */

/** Largest adjustment, either sign, an admin can save. Far above any
 *  real slot price; exists only to stop a typo becoming a ₹10-lakh slot. */
export const MAX_SELF_OPERATE_ADJUSTMENT = 10000;

export interface SelfOperateMachineSetting {
  /** false = operator-only. Absent / true = self-operate allowed. */
  enabled?: boolean;
  /** Per-machine ₹/slot override. null / absent = use the center default. */
  adjustment?: number | null;
}

export type SelfOperateMachineSettings = Record<string, SelfOperateMachineSetting>;

/** The slice of RESOURCE_PRICING_CONFIG these rules read. */
export interface SelfOperateConfig {
  selfOperateAdjustment?: unknown;
  selfOperateMachines?: unknown;
}

function toNumber(raw: unknown): number | null {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/**
 * Coerce whatever is stored (hand-editable policy JSON) to a whole-rupee
 * signed integer within ±MAX. Anything unusable reads as 0 = no
 * adjustment. Numeric strings are accepted.
 */
export function normalizeSelfOperateAdjustment(raw: unknown): number {
  const n = toNumber(raw);
  if (n == null) return 0;
  const whole = Math.trunc(n);
  if (whole > MAX_SELF_OPERATE_ADJUSTMENT) return MAX_SELF_OPERATE_ADJUSTMENT;
  if (whole < -MAX_SELF_OPERATE_ADJUSTMENT) return -MAX_SELF_OPERATE_ADJUSTMENT;
  // Normalise -0 to 0 so it never renders as "−₹0".
  return whole === 0 ? 0 : whole;
}

/**
 * Coerce the per-machine map. Drops malformed entries; keeps only the two
 * known fields. `enabled` accepts real booleans and "true"/"false"
 * strings; an `adjustment` that isn't a usable number is dropped so the
 * machine falls back to the center default (rather than to ₹0).
 */
export function normalizeSelfOperateMachines(raw: unknown): SelfOperateMachineSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SelfOperateMachineSettings = {};
  for (const [machineId, cell] of Object.entries(raw as Record<string, unknown>)) {
    if (!machineId || !cell || typeof cell !== 'object' || Array.isArray(cell)) continue;
    const c = cell as Record<string, unknown>;
    const setting: SelfOperateMachineSetting = {};
    if (c.enabled === false || c.enabled === 'false') setting.enabled = false;
    else if (c.enabled === true || c.enabled === 'true') setting.enabled = true;
    if (toNumber(c.adjustment) != null) {
      setting.adjustment = normalizeSelfOperateAdjustment(c.adjustment);
    }
    if (Object.keys(setting).length > 0) out[machineId] = setting;
  }
  return out;
}

/**
 * Whether players may run this machine themselves. Default true — every
 * machine, leather included, unless the admin switched it off. A request
 * with no machine (an unidentified machine) is treated as allowed, as the
 * booking engine always has.
 */
export function isSelfOperateAllowed(config: SelfOperateConfig | null | undefined, machineId: string | null | undefined): boolean {
  if (!machineId) return true;
  const setting = normalizeSelfOperateMachines(config?.selfOperateMachines)[machineId];
  return setting?.enabled !== false;
}

/**
 * The ₹/slot adjustment for this machine: its own override when set,
 * else the center default. 0 when self-operate isn't allowed on it.
 */
export function resolveSelfOperateAdjustment(config: SelfOperateConfig | null | undefined, machineId: string | null | undefined): number {
  if (!isSelfOperateAllowed(config, machineId)) return 0;
  const setting = machineId ? normalizeSelfOperateMachines(config?.selfOperateMachines)[machineId] : undefined;
  if (setting?.adjustment != null) return normalizeSelfOperateAdjustment(setting.adjustment);
  return normalizeSelfOperateAdjustment(config?.selfOperateAdjustment);
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

/** Player-facing promo copy: "₹100 off" / "+₹100". Empty for 0. */
export function selfOperateBadgeLabel(amount: number | null | undefined): string {
  const n = normalizeSelfOperateAdjustment(amount);
  if (n === 0) return '';
  return n < 0 ? `₹${Math.abs(n)} off` : `+₹${n}`;
}
