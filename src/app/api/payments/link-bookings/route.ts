import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';

// POST /api/payments/link-bookings - Link booking IDs to a payment record after slot booking
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentId, bookingIds } = (await req.json()) as {
      paymentId: string;
      bookingIds: string[];
    };

    if (!paymentId || !bookingIds?.length) {
      return NextResponse.json(
        { error: 'paymentId and bookingIds are required' },
        { status: 400 },
      );
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (payment.userId !== user.id) {
      return NextResponse.json(
        { error: 'Payment does not belong to this user' },
        { status: 403 },
      );
    }

    if (payment.status !== 'CAPTURED') {
      return NextResponse.json(
        { error: 'Payment is not in CAPTURED state' },
        { status: 400 },
      );
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: { bookingIds },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Link bookings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
