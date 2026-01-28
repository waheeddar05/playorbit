import { prisma } from '@/lib/prisma';
import { TIMEZONE } from '@/lib/time';
import { toDate } from 'date-fns-tz';
import { endOfMonth, format, startOfMonth } from 'date-fns';

/**
 * Get the current month-year string in format "YYYY-MM"
 */
export function getCurrentMonthYear(): string {
  const now = toDate(new Date(), { timeZone: TIMEZONE });
  return format(now, 'yyyy-MM');
}

/**
 * Get the end of the current month as a Date
 */
export function getEndOfCurrentMonth(): Date {
  const now = toDate(new Date(), { timeZone: TIMEZONE });
  const end = endOfMonth(now);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Get the start of the current month as a Date
 */
export function getStartOfCurrentMonth(): Date {
  const now = toDate(new Date(), { timeZone: TIMEZONE });
  return startOfMonth(now);
}

/**
 * Get active subscription for a user for the current month
 */
export async function getActiveSubscription(userId: string) {
  const monthYear = getCurrentMonthYear();

  const subscription = await prisma.userSubscription.findFirst({
    where: {
      userId,
      monthYear,
      status: 'ACTIVE',
      sessionsRemaining: { gt: 0 },
    },
    include: {
      plan: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return subscription;
}

/**
 * Get all subscriptions for a user (including expired)
 */
export async function getUserSubscriptions(userId: string) {
  const subscriptions = await prisma.userSubscription.findMany({
    where: { userId },
    include: {
      plan: true,
      _count: {
        select: { bookings: true },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return subscriptions;
}

/**
 * Decrement session count for a subscription
 */
export async function decrementSession(subscriptionId: string) {
  return await prisma.userSubscription.update({
    where: { id: subscriptionId },
    data: {
      sessionsRemaining: {
        decrement: 1,
      },
    },
  });
}

/**
 * Increment session count for a subscription (for cancellation refund)
 */
export async function incrementSession(subscriptionId: string) {
  const subscription = await prisma.userSubscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) return null;

  // Don't exceed the plan's session limit
  const newCount = Math.min(
    subscription.sessionsRemaining + 1,
    subscription.plan.sessionsPerMonth
  );

  return await prisma.userSubscription.update({
    where: { id: subscriptionId },
    data: {
      sessionsRemaining: newCount,
    },
  });
}

/**
 * Check and expire old subscriptions
 */
export async function expireOldSubscriptions() {
  const now = toDate(new Date(), { timeZone: TIMEZONE });

  await prisma.userSubscription.updateMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { lt: now },
    },
    data: {
      status: 'EXPIRED',
    },
  });
}
