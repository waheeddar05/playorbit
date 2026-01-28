import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  getActiveSubscription,
  getUserSubscriptions,
  getCurrentMonthYear,
  getEndOfCurrentMonth,
  expireOldSubscriptions,
} from '@/lib/subscription';

// GET /api/subscriptions - Get current user's subscriptions
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Expire old subscriptions first
    await expireOldSubscriptions();

    const subscriptions = await getUserSubscriptions(user.id);
    const activeSubscription = await getActiveSubscription(user.id);

    return NextResponse.json({
      subscriptions,
      activeSubscription,
      currentMonthYear: getCurrentMonthYear(),
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/subscriptions - Subscribe to a plan (self-subscription)
// Note: In a real app, this would involve payment. For now, it's direct subscription.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId } = await req.json();

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Get the plan
    const plan = await prisma.monthlyPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: 'Invalid or inactive plan' }, { status: 400 });
    }

    const monthYear = getCurrentMonthYear();
    const expiresAt = getEndOfCurrentMonth();

    // Check if user already has a subscription for this plan this month
    const existingSubscription = await prisma.userSubscription.findUnique({
      where: {
        userId_planId_monthYear: {
          userId: user.id,
          planId,
          monthYear,
        },
      },
    });

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'You already have a subscription to this plan for this month' },
        { status: 400 }
      );
    }

    // Create the subscription
    const subscription = await prisma.userSubscription.create({
      data: {
        userId: user.id,
        planId,
        sessionsRemaining: plan.sessionsPerMonth,
        monthYear,
        expiresAt,
        status: 'ACTIVE',
      },
      include: {
        plan: true,
      },
    });

    return NextResponse.json({
      message: 'Subscription created successfully',
      subscription,
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
