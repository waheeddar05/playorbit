import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { reconcileStalePayments } from '@/lib/payment-reconcile';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/payments/status?paymentId=…
 *
 * "What happened to the payment I just made?" — asked by the client when
 * the app comes back to the foreground with a checkout still unresolved.
 *
 * On Android the customer pays in their UPI app and often minimises
 * PlayOrbit before Razorpay's in-page `handler` gets to call
 * `/api/payments/verify`. Chrome freezes or discards the backgrounded
 * page, so the verify call never lands, the Payment row sits in CREATED,
 * and the booking only appeared once the customer opened My Bookings
 * (`recover-mine`). The Razorpay webhook would have covered this, but it
 * isn't reaching us.
 *
 * If the payment is still unfulfilled this runs the reconciler for this
 * one payment — it asks Razorpay whether the order was paid and, if so,
 * books it under the same fulfilment lease verify/webhook/cron use, so a
 * late `verify` landing concurrently waits instead of double-booking.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const paymentId = req.nextUrl.searchParams.get('paymentId');
  if (!paymentId) {
    return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
  }

  const load = () =>
    prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        userId: true,
        status: true,
        paymentType: true,
        bookingIds: true,
        userPackageId: true,
        razorpayPaymentId: true,
        failureReason: true,
      },
    });

  let payment = await load();
  if (!payment || payment.userId !== user.id) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  const isFulfilled = (p: NonNullable<typeof payment>) =>
    p.paymentType === 'PACKAGE_PURCHASE' ? !!p.userPackageId : p.bookingIds.length > 0;

  if (!isFulfilled(payment) && (payment.status === 'CREATED' || payment.status === 'CAPTURED')) {
    try {
      await reconcileStalePayments({ paymentId, source: 'resume', minAgeMs: 0 });
    } catch (e) {
      // Fall through and report whatever state the row is in now; the
      // client keeps the payment pending and asks again on next resume.
      console.error(`[payments/status] reconcile failed for ${paymentId}:`, e);
    }
    payment = (await load()) ?? payment;
  }

  let state: 'fulfilled' | 'pending' | 'refunded' | 'failed';
  if (isFulfilled(payment)) state = 'fulfilled';
  else if (payment.status === 'REFUNDED' || payment.status === 'PARTIALLY_REFUNDED') state = 'refunded';
  else if (payment.status === 'FAILED') state = 'failed';
  else state = 'pending';

  return NextResponse.json({
    state,
    paymentId: payment.id,
    type: payment.paymentType,
    razorpayPaymentId: payment.razorpayPaymentId,
    bookingIds: payment.bookingIds,
    userPackageId: payment.userPackageId,
    error: state === 'refunded' || state === 'failed' ? payment.failureReason : null,
  });
}
