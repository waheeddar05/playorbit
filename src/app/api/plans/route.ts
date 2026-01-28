import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/plans - Get all active plans (public endpoint)
export async function GET() {
  try {
    const plans = await prisma.monthlyPlan.findMany({
      where: { isActive: true },
      orderBy: { sessionsPerMonth: 'asc' },
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error('Get plans error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
