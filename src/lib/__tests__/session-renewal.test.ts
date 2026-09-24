/**
 * @vitest-environment node
 *
 * Node, not jsdom: jsdom's `TextEncoder` returns a Uint8Array from another
 * realm, which `jose` rejects.
 *
 * Sliding renewal is what makes an active WhatsApp session never expire.
 * The invariants: an old token is re-issued with a full lifetime and claims
 * taken from the database, a fresh one is left alone, and renewal can never
 * extend somebody else's session or lift the reviewer above a customer.
 */
import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';

process.env.JWT_SECRET = 'test-secret-for-session-renewal';

vi.mock('@/lib/review-login', () => ({ REVIEW_ACCOUNT_EMAIL: 'play-review@playorbit.invalid' }));

type Jwt = typeof import('@/lib/jwt');
type Renewal = typeof import('@/lib/session-renewal');

let signToken: Jwt['signToken'];
let verifyToken: Jwt['verifyToken'];
let SESSION_TTL_SECONDS: number;
let renewSessionIfStale: Renewal['renewSessionIfStale'];
let NextRequest: typeof import('next/server').NextRequest;
let NextResponse: typeof import('next/server').NextResponse;

const DAY = 24 * 60 * 60;

const USER = {
  id: 'usr_1',
  name: 'Waheed',
  email: null,
  mobileNumber: '9876543210',
  role: 'USER',
  mobileVerified: true,
};

beforeAll(async () => {
  ({ signToken, verifyToken } = await import('@/lib/jwt'));
  ({ SESSION_TTL_SECONDS } = await import('@/lib/session-ttl'));
  ({ renewSessionIfStale } = await import('@/lib/session-renewal'));
  ({ NextRequest, NextResponse } = await import('next/server'));
});

afterEach(() => {
  vi.useRealTimers();
});

/** Mint a token as if it had been issued `ageSeconds` ago. */
async function tokenAged(ageSeconds: number, claims: Record<string, unknown> = {}) {
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() - ageSeconds * 1000);
  const token = await signToken({
    userId: USER.id,
    name: USER.name,
    mobileNumber: USER.mobileNumber,
    role: 'USER',
    mobileVerified: true,
    ...claims,
  });
  vi.useRealTimers();
  return token;
}

function request(token?: string) {
  const req = new NextRequest('https://www.playorbit.in/api/user/profile');
  if (token) req.cookies.set('token', token);
  return req;
}

describe('session lifetime', () => {
  it('issues tokens that live 400 days, the browser cookie cap', async () => {
    const decoded = await verifyToken(await signToken({ userId: 'usr_1' }));

    expect(SESSION_TTL_SECONDS).toBe(400 * DAY);
    expect(decoded!.exp! - decoded!.iat!).toBe(400 * DAY);
  });
});

describe('renewSessionIfStale', () => {
  it('re-issues a token older than a day with a full lifetime', async () => {
    const res = NextResponse.json({});
    const renewed = await renewSessionIfStale(request(await tokenAged(2 * DAY)), res, USER);

    expect(renewed).toBe(true);
    const cookie = res.cookies.get('token');
    expect(cookie?.maxAge).toBe(400 * DAY);
    const decoded = await verifyToken(cookie!.value);
    const now = Math.floor(Date.now() / 1000);
    expect(decoded!.exp! - now).toBeGreaterThan(400 * DAY - 60);
    expect(decoded?.userId).toBe(USER.id);
  });

  it('keeps a session alive that would otherwise have expired tomorrow', async () => {
    const res = NextResponse.json({});
    await renewSessionIfStale(request(await tokenAged(399 * DAY)), res, USER);

    expect(res.cookies.get('token')).toBeDefined();
  });

  it('leaves a token issued within the last day alone', async () => {
    const res = NextResponse.json({});
    const renewed = await renewSessionIfStale(request(await tokenAged(60 * 60)), res, USER);

    expect(renewed).toBe(false);
    expect(res.cookies.get('token')).toBeUndefined();
  });

  it('takes claims from the database row, so a role change reaches the middleware', async () => {
    const res = NextResponse.json({});
    const demoted = { ...USER, role: 'USER' };
    await renewSessionIfStale(request(await tokenAged(2 * DAY, { role: 'ADMIN' })), res, demoted);

    expect((await verifyToken(res.cookies.get('token')!.value))?.role).toBe('USER');
  });

  it('never lifts the reviewer account above a customer session', async () => {
    const res = NextResponse.json({});
    const reviewer = { ...USER, email: 'play-review@playorbit.invalid', role: 'ADMIN' };
    await renewSessionIfStale(request(await tokenAged(2 * DAY)), res, reviewer);

    expect((await verifyToken(res.cookies.get('token')!.value))?.role).toBe('USER');
  });

  it("does not extend a token that belongs to someone else", async () => {
    const res = NextResponse.json({});
    const other = await tokenAged(2 * DAY, { userId: 'usr_other' });

    expect(await renewSessionIfStale(request(other), res, USER)).toBe(false);
    expect(res.cookies.get('token')).toBeUndefined();
  });

  it('does nothing without a valid OTP cookie', async () => {
    const res = NextResponse.json({});

    expect(await renewSessionIfStale(request(), res, USER)).toBe(false);
    expect(await renewSessionIfStale(request('not.a.jwt'), res, USER)).toBe(false);
    expect(res.cookies.get('token')).toBeUndefined();
  });
});
