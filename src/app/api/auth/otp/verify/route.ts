import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/jwt';
import { normalizeIndianMobile } from '@/lib/otp-delivery';
import { setSessionCookie } from '@/lib/session-cookie';
import {
  isReviewLoginMobile,
  reviewOtpMatches,
  REVIEW_ACCOUNT_EMAIL,
  REVIEW_ACCOUNT_NAME,
} from '@/lib/review-login';

/**
 * POST /api/auth/otp/verify — step 2 of the WhatsApp login.
 *
 * Checks the code issued by `/api/auth/otp/request` and, on success, sets
 * the `token` cookie that `getAuthenticatedUser` reads. This is the only
 * way a session is created in the app.
 */
export async function POST(req: NextRequest) {
  try {
    const { mobileNumber, otp } = await req.json();

    if (!mobileNumber || !otp) {
      return NextResponse.json({ error: 'Mobile number and OTP are required' }, { status: 400 });
    }

    // Normalize the same way the request step stored it, so a number typed
    // as +91XXXXXXXXXX still resolves to the row keyed on 10 digits.
    const cleaned = normalizeIndianMobile(mobileNumber);

    // ── Play reviewer ──────────────────────────────────────────────────
    // One number, one fixed code, no stored OTP to check. Handled before
    // the ordinary path because there is deliberately nothing in the `otp`
    // table for this account — the request step never issues one.
    if (isReviewLoginMobile(cleaned)) {
      if (!reviewOtpMatches(otp)) {
        return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
      }

      const existing = await prisma.user.findUnique({
        where: { mobileNumber: cleaned },
        select: { id: true, email: true, name: true },
      });

      // Fail closed. If this number already belongs to a real customer the
      // configuration is wrong, and signing the reviewer in would hand them
      // that person's bookings, payments and phone number. Refuse, shout in
      // the logs, and say no more to the caller than any other bad code does.
      if (existing && existing.email !== REVIEW_ACCOUNT_EMAIL) {
        console.error(
          '[otp.login] REVIEW_LOGIN_MOBILE belongs to a real account — refusing. Point it at an unused number:',
          { userId: existing.id },
        );
        return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
      }

      const reviewer = existing
        ? await prisma.user.update({
            where: { id: existing.id },
            data: { lastSeen: new Date(), mobileVerified: true, phonePromptDismissed: true },
            select: { id: true, name: true, mobileNumber: true },
          })
        : await prisma.user.create({
            data: {
              name: REVIEW_ACCOUNT_NAME,
              email: REVIEW_ACCOUNT_EMAIL,
              mobileNumber: cleaned,
              authProvider: 'WHATSAPP',
              role: 'USER',
              mobileVerified: true,
              phonePromptDismissed: true,
              lastSeen: new Date(),
            },
            select: { id: true, name: true, mobileNumber: true },
          });

      console.log('[otp.login] Review login succeeded:', { userId: reviewer.id });

      // Hard-coded, not read off the row: an ordinary customer session is
      // all a store reviewer needs, and nothing that happens to this
      // account later can turn this into an admin session.
      const reviewToken = await signToken({
        userId: reviewer.id,
        name: reviewer.name,
        email: REVIEW_ACCOUNT_EMAIL,
        mobileNumber: reviewer.mobileNumber,
        role: 'USER',
        mobileVerified: true,
        isSuperAdmin: false,
        isStoreAdmin: false,
      });

      const reviewResponse = NextResponse.json({ message: 'Login successful' });
      setSessionCookie(reviewResponse, reviewToken);
      return reviewResponse;
    }

    const user = await prisma.user.findUnique({
      where: { mobileNumber: cleaned },
      include: {
        otps: {
          where: {
            used: false,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user || user.otps.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
    }

    const latestOtp = user.otps[0];

    // Brute-force guard. The code is 6 digits and lives for OTP_TTL_MINUTES,
    // so without a cap the whole keyspace is guessable inside the window —
    // and this is the only login. Each wrong guess is counted; past the cap
    // the code is burned and the user has to request a new one (which the
    // 3-per-10-minutes issue limit then bounds too).
    const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS) || 5;
    if (latestOtp.attempts >= maxAttempts) {
      await prisma.otp.update({ where: { id: latestOtp.id }, data: { used: true } });
      return NextResponse.json(
        { error: 'Too many incorrect attempts. Please request a new code.' },
        { status: 429 },
      );
    }

    const isMatch = await bcrypt.compare(otp, latestOtp.codeHash);

    if (!isMatch) {
      const attempts = latestOtp.attempts + 1;
      await prisma.otp.update({
        where: { id: latestOtp.id },
        // Burn the code on the last allowed miss rather than leaving it
        // live for the rest of its TTL.
        data: { attempts, used: attempts >= maxAttempts },
      });
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    // Super-admin bootstrap, phone-keyed. The Google path already does
    // exactly this for SUPER_ADMIN_EMAIL in authOptions.signIn ("promote
    // now, never demote"); without the mobile twin there is no way to
    // bootstrap the first super admin on a WhatsApp-only install, because
    // every other path matches on an email these accounts don't have.
    // `role` has to move too, not just the flag: the middleware gates
    // /admin on the role in this token, so an isSuperAdmin with role=USER
    // would still be bounced at the door.
    const superAdminMobile = (process.env.SUPER_ADMIN_MOBILE || '').replace(/\D/g, '').slice(-10);
    const isBootstrapSuperAdmin = !!superAdminMobile && cleaned === superAdminMobile;
    const promote = isBootstrapSuperAdmin && (!user.isSuperAdmin || user.role !== 'ADMIN');
    if (promote) {
      console.log('[otp.login] Bootstrapping super admin from SUPER_ADMIN_MOBILE:', { userId: user.id });
    }

    // Mark the code used and stamp the login. Receiving the code IS proof
    // of the number, so the account is mobile-verified from here on — that
    // is what keeps a WhatsApp user out of the /verify-mobile gate, which
    // exists only to collect a number Google sign-in never provided.
    // Atomic: a used code must never leave the account unverified.
    await prisma.$transaction([
      prisma.otp.update({
        where: { id: latestOtp.id },
        data: { used: true },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          lastSeen: new Date(),
          mobileVerified: true,
          phonePromptDismissed: true,
          // Only ever an upgrade — the fields are omitted entirely when
          // the number isn't the configured one, so this can't demote.
          ...(promote ? { role: 'ADMIN' as const, isSuperAdmin: true } : {}),
        },
      }),
    ]);

    // The middleware reads `role` off this token to gate /admin and /staff,
    // so it has to carry the same shape the NextAuth token does — and the
    // role it was just promoted to, not the one read before the update.
    // `mobileVerified` is always true here by construction (above).
    const token = await signToken({
      userId: user.id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: promote ? 'ADMIN' : user.role,
      mobileVerified: true,
    });

    const response = NextResponse.json({ message: 'Login successful' });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('OTP verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
