import type { NextRequest, NextResponse } from 'next/server';
import { signToken, verifyToken } from '@/lib/jwt';
import { SESSION_COOKIE_NAME, setSessionCookie } from '@/lib/session-cookie';
import { REVIEW_ACCOUNT_EMAIL } from '@/lib/review-login';

/**
 * Sliding renewal for the WhatsApp (OTP JWT) session.
 *
 * A session lives `SESSION_TTL_SECONDS` (400 days, the browser cookie cap)
 * from when it was issued. Re-issuing it while the app is in use turns that
 * into an idle limit: someone who opens the app at least once in 400 days is
 * never signed out.
 *
 * It runs from `GET /api/user/profile`, which `CurrentUserProvider` calls on
 * every app load, so it needs no extra request, and it runs in the Node
 * runtime with the user row already loaded. That matters because the
 * middleware gates `/admin` on the `role` claim. Renewing at the edge could
 * only copy the old claims forward, so a demoted admin would keep that role
 * for as long as they stayed active. Re-signing from the database brings the
 * claims up to date within a day instead.
 *
 * A deleted user can't renew (`getAuthenticatedUser` finds no row), but a
 * token already issued stays valid until it expires. Nothing server-side can
 * revoke it.
 */

/** Re-issue at most once a day, so we don't set a cookie on every request. */
export const SESSION_RENEW_AFTER_SECONDS = 24 * 60 * 60;

export interface SessionUser {
  id: string;
  name: string | null;
  email: string | null;
  mobileNumber: string | null;
  role: string;
  mobileVerified: boolean;
}

/**
 * Attach a fresh session cookie to `response` when the request's OTP token
 * belongs to `user` and is more than a day old. Returns whether it renewed.
 *
 * A request authenticated by a legacy NextAuth session, or carrying no OTP
 * cookie, is left alone: there is no OTP session of this user's to extend.
 */
export async function renewSessionIfStale(
  req: NextRequest,
  response: NextResponse,
  user: SessionUser,
): Promise<boolean> {
  const raw = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return false;

  const decoded = await verifyToken(raw);
  if (!decoded || decoded.userId !== user.id) return false;

  const now = Math.floor(Date.now() / 1000);
  if (typeof decoded.iat === 'number' && now - decoded.iat < SESSION_RENEW_AFTER_SECONDS) {
    return false;
  }

  const token = await signToken({
    userId: user.id,
    name: user.name,
    email: user.email,
    mobileNumber: user.mobileNumber,
    // Same cap the verify route applies: the Play reviewer's published
    // credential must never become more than a customer session, whatever
    // happens to that row later.
    role: user.email === REVIEW_ACCOUNT_EMAIL ? 'USER' : user.role,
    mobileVerified: user.mobileVerified,
  });
  setSessionCookie(response, token);
  return true;
}
