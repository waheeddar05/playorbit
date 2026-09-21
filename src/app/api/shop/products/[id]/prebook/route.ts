import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';
import { sanitizeApiError } from '@/lib/api-errors';
import { getMarketplaceConfig } from '@/lib/marketplace-server';
import { notifyInfo } from '@/lib/notifications';
import { formatAddressLines } from '@/lib/addresses';
import { PreBookInputSchema, formatRupees, type MyPreBookingView } from '@/lib/marketplace';

type Params = { id: string };

/**
 * Pre-book a product — hold one for me, before the store sells from stock.
 *
 *   POST   /api/shop/products/[id]/prebook   record it (or revise it)
 *   DELETE /api/shop/products/[id]/prebook   call it off
 *
 * **No money moves here and none is meant to.** A pre-booking is a
 * promise recorded on both sides: the customer says what they want and
 * where it goes, the store gets a list it can work. There is no payment
 * intent, no order total to settle, nothing to refund if it is
 * cancelled. Anything that looks like it belongs in a checkout does not
 * belong in this file.
 *
 * Signed-in only. The route sits under the public /api/shop prefix so an
 * anonymous call reaches it and gets a clean JSON 401 rather than the
 * middleware's HTML redirect, which the product page turns into a
 * sign-in prompt.
 */

/** What the product page needs back about the viewer's own booking. */
const MINE_SELECT = {
  id: true,
  productId: true,
  quantity: true,
  size: true,
  unitPrice: true,
  status: true,
  createdAt: true,
} as const;

function toMine(row: {
  id: string;
  productId: string;
  quantity: number;
  size: string | null;
  unitPrice: number;
  status: MyPreBookingView['status'];
  createdAt: Date;
}): MyPreBookingView {
  return {
    id: row.id,
    productId: row.productId,
    quantity: row.quantity,
    size: row.size,
    unitPrice: row.unitPrice,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function POST(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Please sign in to pre-book' }, { status: 401 });

    const { id } = await ctx.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = PreBookInputSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Check the quantity and try again' },
        { status: 400 },
      );
    }
    const { quantity, size } = parsed.data;

    const [product, config] = await Promise.all([
      prisma.marketplaceProduct.findUnique({
        where: { id },
        select: { id: true, name: true, price: true, isActive: true, sizes: true },
      }),
      getMarketplaceConfig(),
    ]);
    // Same visibility gate as the product page: a hidden product, or a
    // store that is switched off, is not on offer and cannot be held.
    if (!product || !product.isActive || !config.enabled) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    // Once the store sells from stock there is nothing to pre-book —
    // that is an order, and it goes down a different path.
    if (!config.comingSoon) {
      return NextResponse.json(
        { error: 'This product is on sale now — place an order instead of pre-booking.' },
        { status: 409 },
      );
    }
    // A size the product does not come in would make the list unworkable.
    if (size && product.sizes.length > 0 && !product.sizes.includes(size)) {
      return NextResponse.json({ error: 'Pick one of the listed sizes' }, { status: 400 });
    }

    // Delivery details are a snapshot, not a join: the customer may edit
    // or delete this address tomorrow, and the store needs to see what
    // they actually asked for.
    const address = await prisma.userAddress.findFirst({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      select: {
        fullName: true,
        phone: true,
        line1: true,
        line2: true,
        landmark: true,
        city: true,
        state: true,
        pincode: true,
      },
    });
    const addressText = address ? formatAddressLines(address).join('\n') : null;

    const snapshot = {
      productName: product.name,
      unitPrice: product.price,
      quantity,
      size: size ?? null,
      contactName: address?.fullName ?? null,
      contactPhone: address?.phone ?? null,
      addressText,
      status: 'PENDING' as const,
    };

    // One standing pre-booking per person per product. Tapping again
    // revises it — including reviving one they had cancelled — rather
    // than queuing a second bat.
    const row = await prisma.marketplacePreBooking.upsert({
      where: { productId_userId: { productId: id, userId: user.id } },
      create: { productId: id, userId: user.id, ...snapshot },
      update: snapshot,
      select: MINE_SELECT,
    });

    // Telling them it landed is the point of the feature, but it must
    // never be the reason the pre-booking fails — the row is saved by
    // the time we get here.
    try {
      const total = formatRupees(product.price * quantity);
      await notifyInfo(
        user.id,
        'Pre-booking confirmed',
        `We've noted your pre-booking for ${quantity} × ${product.name} (${total}). ` +
          `Nothing to pay now — we'll message you as soon as it's ready to collect.`,
      );
    } catch (err) {
      console.error('[shop.prebook] notification failed', err);
    }

    return NextResponse.json({ preBooking: toMine(row) });
  } catch (error) {
    const { message, status } = sanitizeApiError(error, 'shop.prebook.create');
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    // Cancelled rather than deleted: the store has very likely already
    // acted on this row, and a booking that vanishes is worse for them
    // than one marked off. `updateMany` also makes this idempotent and
    // scopes it to the caller's own row in a single statement.
    await prisma.marketplacePreBooking.updateMany({
      where: { productId: id, userId: user.id },
      data: { status: 'CANCELLED' },
    });
    return NextResponse.json({ preBooking: null });
  } catch (error) {
    const { message, status } = sanitizeApiError(error, 'shop.prebook.cancel');
    return NextResponse.json({ error: message }, { status });
  }
}
