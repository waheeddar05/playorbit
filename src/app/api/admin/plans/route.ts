import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from 'next-auth/jwt';
import { verifyToken } from '@/lib/jwt';

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

// GET /api/admin/plans - Get all plans (including inactive)
export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (session?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const plans = await prisma.monthlyPlan.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error('Admin get plans error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/plans - Create a new plan
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (session?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { name, sessionsPerMonth, price, isActive } = await req.json();

    if (!name || !sessionsPerMonth) {
      return NextResponse.json(
        { error: 'Name and sessions per month are required' },
        { status: 400 }
      );
    }

    const plan = await prisma.monthlyPlan.create({
      data: {
        name,
        sessionsPerMonth: parseInt(sessionsPerMonth),
        price: price ? parseFloat(price) : 0,
        isActive: isActive !== false,
      },
    });

    return NextResponse.json({ message: 'Plan created successfully', plan });
  } catch (error) {
    console.error('Admin create plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/plans - Update a plan
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (session?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id, name, sessionsPerMonth, price, isActive } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (sessionsPerMonth !== undefined) updateData.sessionsPerMonth = parseInt(sessionsPerMonth);
    if (price !== undefined) updateData.price = parseFloat(price);
    if (isActive !== undefined) updateData.isActive = isActive;

    const plan = await prisma.monthlyPlan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ message: 'Plan updated successfully', plan });
  } catch (error) {
    console.error('Admin update plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/plans - Delete a plan (soft delete by setting isActive = false)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (session?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Check if plan has active subscriptions
    const activeSubscriptions = await prisma.userSubscription.count({
      where: {
        planId: id,
        status: 'ACTIVE',
      },
    });

    if (activeSubscriptions > 0) {
      // Soft delete - just deactivate
      await prisma.monthlyPlan.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        message: 'Plan deactivated (has active subscriptions)',
      });
    }

    // Hard delete if no active subscriptions
    await prisma.monthlyPlan.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    console.error('Admin delete plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
