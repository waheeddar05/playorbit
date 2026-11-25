/**
 * Pitch assignment for center staff (operators, ground staff, sidearm
 * specialists, coaches).
 *
 * An admin marks which playing surface a staff member works on:
 *
 *   INDOOR_ASTRO  — the indoor astro-turf nets
 *   NATURAL_TURF  — the outdoor natural-turf wickets
 *
 * A member may be assigned to both, or to neither (not yet assigned).
 *
 * Stored on `CenterMembership.metadata.pitchAssignments` rather than a
 * new column: the metadata JSON exists precisely so per-center staff
 * attributes can be added without schema churn, and a membership is
 * per (user, center, role), so the same person can be turf ground staff
 * but an indoor operator. Writers must merge into the existing metadata
 * (see `withPitchAssignments`) — other keys live there too.
 */

export const STAFF_PITCH_ASSIGNMENTS = ['INDOOR_ASTRO', 'NATURAL_TURF'] as const;

export type StaffPitchAssignment = (typeof STAFF_PITCH_ASSIGNMENTS)[number];

export const STAFF_PITCH_LABELS: Record<StaffPitchAssignment, string> = {
  INDOOR_ASTRO: 'Indoor (Astro-turf nets)',
  NATURAL_TURF: 'Natural turf',
};

/** Short form for chips where space is tight. */
export const STAFF_PITCH_SHORT_LABELS: Record<StaffPitchAssignment, string> = {
  INDOOR_ASTRO: 'Indoor Astro',
  NATURAL_TURF: 'Natural Turf',
};

export function isStaffPitchAssignment(v: unknown): v is StaffPitchAssignment {
  return typeof v === 'string' && (STAFF_PITCH_ASSIGNMENTS as readonly string[]).includes(v);
}

function asRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

/** Read a membership's pitch assignments, ignoring anything malformed.
 *  Always returned in catalog order, deduped. */
export function readPitchAssignments(metadata: unknown): StaffPitchAssignment[] {
  const raw = asRecord(metadata).pitchAssignments;
  if (!Array.isArray(raw)) return [];
  return STAFF_PITCH_ASSIGNMENTS.filter((p) => raw.includes(p));
}

/** Return a copy of `metadata` with `pitchAssignments` replaced, every
 *  other key preserved. An empty list removes the key. */
export function withPitchAssignments(
  metadata: unknown,
  assignments: readonly StaffPitchAssignment[],
): Record<string, unknown> {
  const next = { ...asRecord(metadata) };
  const normalised = STAFF_PITCH_ASSIGNMENTS.filter((p) => assignments.includes(p));
  if (normalised.length === 0) delete next.pitchAssignments;
  else next.pitchAssignments = normalised;
  return next;
}

/**
 * The staff surface a booking sits on, for picking who works it.
 *
 *   FULL_OUTDOOR_COURT                  → NATURAL_TURF (always turf)
 *   FULL_COURT / CORPORATE_BATCH        → INDOOR_ASTRO (indoor nets)
 *   pitchType NATURAL                   → NATURAL_TURF
 *   pitchType ASTRO, or no pitch on a
 *   net-pool category (the engine puts
 *   those on the indoor NET pool)       → INDOOR_ASTRO
 *   anything else (CEMENT, match
 *   practice, unknown)                  → null — no staff-pitch constraint
 */
export function staffPitchForBooking(
  category: string | null | undefined,
  pitchType: string | null | undefined,
): StaffPitchAssignment | null {
  if (category === 'FULL_OUTDOOR_COURT') return 'NATURAL_TURF';
  if (category === 'FULL_COURT' || category === 'CORPORATE_BATCH') return 'INDOOR_ASTRO';
  if (pitchType === 'NATURAL') return 'NATURAL_TURF';
  if (pitchType === 'ASTRO') return 'INDOOR_ASTRO';
  if (
    pitchType == null &&
    (category === 'NET' || category === 'MACHINE' || category === 'SIDEARM' || category === 'COACHING')
  ) {
    return 'INDOOR_ASTRO';
  }
  return null;
}

/**
 * Can this member work a booking on `pitch`?
 *
 * A member with no pitch assignment is eligible everywhere (centers that
 * never set assignments keep their old behaviour). A member assigned to
 * one or more pitches only works those. No pitch = no constraint.
 */
export function memberServesPitch(metadata: unknown, pitch: StaffPitchAssignment | null): boolean {
  if (!pitch) return true;
  const assigned = readPitchAssignments(metadata);
  return assigned.length === 0 || assigned.includes(pitch);
}

/**
 * Members who can work `pitch`, best candidates first: those explicitly
 * assigned to the pitch, then unassigned members, each group keeping the
 * caller's (priority) order. Members assigned only to other pitches are
 * dropped. Without a pitch the list is returned unchanged.
 */
export function rankStaffForPitch<T extends { metadata?: unknown }>(
  members: readonly T[],
  pitch: StaffPitchAssignment | null,
): T[] {
  if (!pitch) return [...members];
  const assigned: T[] = [];
  const unassigned: T[] = [];
  for (const m of members) {
    const a = readPitchAssignments(m.metadata);
    if (a.length === 0) unassigned.push(m);
    else if (a.includes(pitch)) assigned.push(m);
  }
  return [...assigned, ...unassigned];
}
