import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sanitizeApiError } from '@/lib/api-errors';
import { PRE_BOOKING_STATUSES } from '@/lib/marketplace';
import { forbidden, readJson, requireShopAdmin } from '../../../../shared';

type Params = { id: string; bookingId: string };

/**
 * PATCH /api/admin/shop/products/[id]/prebookings/[bookingId]
 *
 * Move a pre-booking along as the store works the list: New → Holding →
 * Collected, or Cancelled. Nothing here settles money, because a
 * pre-booking never took any.
 *
 * A note can be saved alongside; the store writes down what was agreed
 * on the phone ("wants the 2lb 9oz", "collecting Saturday").
 */
const PatchSchema = z.object({
  status: z.enum(PRE_BOOKING_STATUSES).optional(),
  adminNote: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireShopAdmin(req);
    if (!auth) return forbidden();

    const { id, bookingId } = await ctx.params;
    const parsed = PatchSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Check the request and try again' },
        { status: 400 },
      );
    }
    if (parsed.data.status === undefined && parsed.data.adminNote === undefined) {
      return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
    }

    // Scoped to the product in the path, so a mistyped id can't move a
    // booking that belongs to a different product.
    const result = await prisma.marketplacePreBooking.updateMany({
      where: { id: bookingId, productId: id },
      data: {
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.adminNote !== undefined ? { adminNote: parsed.data.adminNote || null } : {}),
      },
    });
    if (result.count === 0) return NextResponse.json({ error: 'Pre-booking not found' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = sanitizeApiError(error, 'admin.shop.prebooking.update');
    return NextResponse.json({ error: message }, { status });
  }
}
