/**
 * Google Play reviewer sign-in.
 *
 * The only way into PlayOrbit is a one-time code delivered over WhatsApp
 * (SMS as the backstop) to an Indian mobile. A Play reviewer owns none of
 * those numbers and cannot receive the code, so "App access" has to be
 * given credentials that work without a message ever being delivered —
 * otherwise the release is rejected as "login required, no working test
 * account".
 *
 * This carves out exactly one number whose code is fixed and never sent.
 * Every part of it is deliberately narrow:
 *
 *   - Inert unless BOTH REVIEW_LOGIN_MOBILE and REVIEW_LOGIN_OTP are set,
 *     so preview and local builds keep the ordinary flow untouched.
 *   - The code must be exactly OTP_DIGITS digits: the login inputs are
 *     `maxLength={6}`, so a longer secret could not be typed by the one
 *     person it exists for.
 *   - It refuses to arm at all if the number collides with an admin
 *     bootstrap number, so this can never mint an admin session.
 *   - Comparison is constant time, over a fixed-width digest so the
 *     length of a wrong guess doesn't leak either.
 *
 * The fail-closed rule that matters most lives in the verify route: the
 * session is only ever issued for the dedicated account this flow owns,
 * identified by REVIEW_ACCOUNT_EMAIL. If the configured number turns out
 * to belong to a real customer, the reviewer is refused rather than handed
 * that person's bookings, payments and history.
 */

import { createHash, timingSafeEqual } from 'crypto';
import { isValidIndianMobile } from '@/lib/whatsapp';
import { normalizeIndianMobile } from '@/lib/otp-delivery';

/**
 * Marker for the dedicated reviewer account.
 *
 * `email` is the right field to key this on: it is unique, and a
 * WhatsApp-login account never has one, so it cannot collide with a real
 * customer and the reviewer has no screen on which to change it. `.invalid`
 * is reserved by RFC 2606 and can never be a deliverable address.
 */
export const REVIEW_ACCOUNT_EMAIL = 'play-review@playorbit.invalid';

/** Display name given to the reviewer account when it is first created. */
export const REVIEW_ACCOUNT_NAME = 'Play Store Reviewer';

/** Fixed by the OTP inputs in LoginModal and /otp, both maxLength 6. */
const OTP_DIGITS = 6;

export interface ReviewLoginConfig {
  /** Normalized to the bare 10 digits used for storage. */
  mobileNumber: string;
  otp: string;
}

/** Numbers that bootstrap elevated roles — never reusable as the reviewer. */
function adminMobiles(): string[] {
  return [process.env.SUPER_ADMIN_MOBILE, process.env.INITIAL_ADMIN_MOBILE]
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    .map((v) => normalizeIndianMobile(v));
}

/**
 * Misconfiguration is logged once per instance rather than on every login
 * attempt: it is a deploy-time mistake, and the login path is public.
 */
let warnedFor: string | null = null;
function warnOnce(reason: string): null {
  if (warnedFor !== reason) {
    warnedFor = reason;
    console.error('[review-login] disabled —', reason);
  }
  return null;
}

/**
 * The armed reviewer credentials, or null when the carve-out is off.
 *
 * Read per call rather than cached at module load so a corrected env var
 * takes effect on the next invocation instead of the next cold start.
 */
export function getReviewLoginConfig(): ReviewLoginConfig | null {
  const rawMobile = process.env.REVIEW_LOGIN_MOBILE;
  const otp = process.env.REVIEW_LOGIN_OTP;

  // Not configured at all is the normal state everywhere except production,
  // so it is silent — only a half-configured or invalid pair is shouted about.
  if (!rawMobile?.trim() && !otp?.trim()) return null;
  if (!rawMobile?.trim() || !otp?.trim()) {
    return warnOnce('set BOTH REVIEW_LOGIN_MOBILE and REVIEW_LOGIN_OTP, or neither');
  }

  if (!isValidIndianMobile(rawMobile)) {
    return warnOnce('REVIEW_LOGIN_MOBILE is not a valid Indian mobile number');
  }
  if (!new RegExp(`^\\d{${OTP_DIGITS}}$`).test(otp)) {
    return warnOnce(`REVIEW_LOGIN_OTP must be exactly ${OTP_DIGITS} digits`);
  }

  const mobileNumber = normalizeIndianMobile(rawMobile);
  if (adminMobiles().includes(mobileNumber)) {
    return warnOnce('REVIEW_LOGIN_MOBILE collides with an admin bootstrap number');
  }

  return { mobileNumber, otp };
}

/** True when this (already normalized) number is the reviewer's. */
export function isReviewLoginMobile(cleanedMobile: string): boolean {
  const config = getReviewLoginConfig();
  return config !== null && config.mobileNumber === cleanedMobile;
}

/** Constant-time check of a supplied code against the configured one. */
export function reviewOtpMatches(supplied: unknown): boolean {
  const config = getReviewLoginConfig();
  if (!config) return false;

  const supplied_ = createHash('sha256').update(String(supplied ?? '')).digest();
  const expected = createHash('sha256').update(config.otp).digest();
  return timingSafeEqual(supplied_, expected);
}
