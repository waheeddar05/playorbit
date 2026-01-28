import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from 'next-auth/jwt';
import { verifyToken } from '@/lib/jwt';
import {
  getCurrentMonthYear,
  getEndOfCurrentMonth,
  expireOldSubscriptions,
} from '@/lib/subscription';

async function getSession(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token) return { role: token.role, email: token.email };

  const otpTokenStr = req.cookies.get('token')?.value;
  if (otpTokenStr) {
    const otpToken = verifyToken(otpTokenStr) as any;
    return { role: otpToken?.role, email: otpToken?.email };
  }
  return null;
}

// GET /api/admin/subscriptions - Get all subscriptions with filters
export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (session?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Expire old subscriptions first
    await expireOldSubscriptions();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const monthYear = searchParams.get('monthYear');
    const userId = searchParams.get('userId');

    const where: any = {};
    if (status) where.status = status;
    if (monthYear) where.monthYear = monthYear;
    if (userId) where.userId = userId;

    const subscriptions = await prisma.userSubscription.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobileNumber: true,
          },
        },
        plan: true,
        _count: {
          select: { bookings: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error('Admin get subscriptions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/subscriptions - Assign a plan to a user
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (session?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { userId, planId, sessionsOverride } = await req.json();

    if (!userId || !planId) {
      return NextResponse.json(
        { error: 'User ID and Plan ID are required' },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify plan exists and is active
    const plan = await prisma.monthlyPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const monthYear = getCurrentMonthYear();
    const expiresAt = getEndOfCurrentMonth();

    // Check if user already has a subscription for this plan this month
    const existingSubscription = await prisma.userSubscription.findUnique({
      where: {
        userId_planId_monthYear: {
          userId,
          planId,
          monthYear,
        },
      },
    });

    if (existingSubscription) {
      // Update existing subscription
      const updatedSubscription = await prisma.userSubscription.update({
        where: { id: existingSubscription.id },
        data: {
          sessionsRemaining: sessionsOverride ?? plan.sessionsPerMonth,
          status: 'ACTIVE',
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          plan: true,
        },
      });

      return NextResponse.json({
        message: 'Subscription updated successfully',
        subscription: updatedSubscription,
      });
    }

    // Create new subscription
    const subscription = await prisma.userSubscription.create({
      data: {
        userId,
        planId,
        sessionsRemaining: sessionsOverride ?? plan.sessionsPerMonth,
        monthYear,
        expiresAt,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        plan: true,
      },
    });

    return NextResponse.json({
      message: 'Subscription assigned successfully',
      subscription,
    });
  } catch (error) {
    console.error('Admin assign subscription error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/subscriptions - Update a subscription (adjust sessions, status)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (session?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id, sessionsRemaining, status } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (sessionsRemaining !== undefined) updateData.sessionsRemaining = parseInt(sessionsRemaining);
    if (status !== undefined) updateData.status = status;

    const subscription = await prisma.userSubscription.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        plan: true,
      },
    });

    return NextResponse.json({
      message: 'Subscription updated successfully',
      subscription,
    });
  } catch (error) {
    console.error('Admin update subscription error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/subscriptions - Cancel a subscription
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (session?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 });
    }

    await prisma.userSubscription.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('Admin cancel subscription error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
