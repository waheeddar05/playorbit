import { createHash } from 'node:crypto';

/**
 * Deterministic Booking id for one (fulfilment attempt, slot index) pair.
 *
 * Booking inserts MUST be idempotent, because two layers below this code
 * retry writes that may already have been applied:
 *
 *  1. Prisma's Accelerate/Data-Proxy engine retries *individual queries*
 *     up to 3 times whenever the HTTP call fails with a retryable status
 *     (`withRetry` in @prisma/client's DataProxyEngine — the source of the
 *     "Attempt 1/3 failed for querying / Retrying after Nms" warnings in
 *     production). A Cloudflare 1102 ("Worker exceeded resource limits")
 *     is raised *after* the query reaches Postgres, so the INSERT commits
 *     and the response is lost. With a server-generated `@default(cuid())`
 *     the retry produced a *second* row with a fresh id, inside the same
 *     transaction — two identical bookings for one payment, only the last
 *     of which got linked into `Payment.bookingIds`.
 *  2. This function's own transaction retry loop, and
 *     `executeResourceBooking`'s outer retry, both re-run the whole body
 *     after an error that may have committed.
 *
 * Deriving the id from a stable key makes every one of those replays land
 * on the same primary key, so the upsert below is a no-op instead of a
 * duplicate. For online bookings the key is the Payment id — stable across
 * verify, the webhook and the reconciler, so no two fulfilment paths can
 * ever produce two rows for one payment either.
 *
 * Output is a 25-char lowercase alphanumeric string, same shape as the
 * cuid Prisma would have generated.
 */
export function deterministicBookingId(fulfilmentKey: string, index: number): string {
  const digest = createHash('sha256').update(`${fulfilmentKey}:${index}`).digest('hex');
  const base36 = BigInt(`0x${digest}`).toString(36).padStart(24, '0');
  return `b${base36.slice(-24)}`;
}
