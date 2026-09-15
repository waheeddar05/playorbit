import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────
// review-login itself is pure, but it imports the canonical mobile
// helpers rather than re-deriving them — and those drag in Prisma and
// the messaging providers. Stub the leaves, keep `normalizeIndianMobile`
// real, and mirror `isValidIndianMobile` with its actual rule, exactly
// as the OTP route test does.

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/sms', () => ({ sendSMS: vi.fn() }));
vi.mock('@/lib/policy-cache', () => ({ getCachedPolicy: vi.fn() }));
vi.mock('@/lib/whatsapp-deliverability', () => ({
  isWhatsAppUndeliverable: vi.fn(async () => false),
  isWhatsAppAccountBlocked: vi.fn(async () => false),
}));
vi.mock('@/lib/whatsapp', () => ({
  sendWhatsAppOTP: vi.fn(),
  sendWhatsAppNotification: vi.fn(),
  isValidIndianMobile: (m: string) => /^(\+?91)?[6-9]\d{9}$/.test(String(m).replace(/[\s-]/g, '')),
}));

import {
  getReviewLoginConfig,
  isReviewLoginMobile,
  reviewOtpMatches,
} from '@/lib/review-login';

const REVIEW_MOBILE = '6000000001';
const REVIEW_OTP = '246813';

const ENV_KEYS = [
  'REVIEW_LOGIN_MOBILE',
  'REVIEW_LOGIN_OTP',
  'SUPER_ADMIN_MOBILE',
  'INITIAL_ADMIN_MOBILE',
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

function arm(mobile = REVIEW_MOBILE, otp = REVIEW_OTP) {
  process.env.REVIEW_LOGIN_MOBILE = mobile;
  process.env.REVIEW_LOGIN_OTP = otp;
}

describe('review login — when it refuses to arm', () => {
  it('is off when neither variable is set (the normal state)', () => {
    expect(getReviewLoginConfig()).toBeNull();
    expect(isReviewLoginMobile(REVIEW_MOBILE)).toBe(false);
    expect(reviewOtpMatches(REVIEW_OTP)).toBe(false);
  });

  it('is off, loudly, when only one half is set', () => {
    process.env.REVIEW_LOGIN_MOBILE = REVIEW_MOBILE;
    expect(getReviewLoginConfig()).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('rejects a code that is not exactly 6 digits — the input is maxLength 6', () => {
    for (const bad of ['12345', '1234567', 'abcdef', '12 34 56', '']) {
      arm(REVIEW_MOBILE, bad);
      expect(getReviewLoginConfig()).toBeNull();
    }
  });

  it('rejects a number that is not a valid Indian mobile', () => {
    for (const bad of ['1234567890', '5000000000', '60000000', 'not-a-number']) {
      arm(bad);
      expect(getReviewLoginConfig()).toBeNull();
    }
  });

  it('refuses to reuse an admin bootstrap number, in either form', () => {
    arm();
    process.env.SUPER_ADMIN_MOBILE = REVIEW_MOBILE;
    expect(getReviewLoginConfig()).toBeNull();

    delete process.env.SUPER_ADMIN_MOBILE;
    process.env.INITIAL_ADMIN_MOBILE = `+91${REVIEW_MOBILE}`;
    expect(getReviewLoginConfig()).toBeNull();
  });
});

describe('review login — when it is armed', () => {
  beforeEach(() => arm());

  it('normalizes the configured number to the 10 digits used for storage', () => {
    expect(getReviewLoginConfig()).toEqual({ mobileNumber: REVIEW_MOBILE, otp: REVIEW_OTP });

    arm(`+91 ${REVIEW_MOBILE}`);
    expect(getReviewLoginConfig()?.mobileNumber).toBe(REVIEW_MOBILE);
  });

  it('matches only the reviewer number', () => {
    expect(isReviewLoginMobile(REVIEW_MOBILE)).toBe(true);
    expect(isReviewLoginMobile('9876543210')).toBe(false);
    expect(isReviewLoginMobile('')).toBe(false);
  });

  it('accepts the exact code and nothing else', () => {
    expect(reviewOtpMatches(REVIEW_OTP)).toBe(true);
    for (const wrong of ['246814', '24681', '2468130', ' 246813', '', null, undefined, 24681]) {
      expect(reviewOtpMatches(wrong)).toBe(false);
    }
  });

  it('picks up a corrected value without needing a cold start', () => {
    expect(reviewOtpMatches('111111')).toBe(false);
    arm(REVIEW_MOBILE, '111111');
    expect(reviewOtpMatches('111111')).toBe(true);
  });
});
