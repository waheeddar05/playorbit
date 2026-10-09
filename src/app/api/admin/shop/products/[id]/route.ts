import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sanitizeApiError } from '@/lib/api-errors';
import {
  ProductInputSchema,
  type MarketplaceInterestView,
  type MarketplacePreBookingView,
} from '@/lib/marketplace';
import { ADMIN_PRODUCT_SELECT, forbidden, readJson, requireShopAdmin, toAdminProductView } from '../../shared';

type Params = { id: string };

/**
 *   GET    /api/admin/shop/products/[id]   product, its pre-bookings and its Notify-me list
 *   PATCH  /api/admin/shop/products/[id]   replace (complete body)
 *   DELETE /api/admin/shop/products/[id]   remove (cascades images + interests)
 *
 * PATCH takes the whole product, same schema as create, so a field can't
 * be blanked in isolation.
 */
const notFound = () => NextResponse.json({ error: 'Product not found' }, { status: 404 });

async function productExists(id: string): Promise<boolean> {
  const row = await prisma.marketplaceProduct.findUnique({ where: { id }, select: { id: true } });
  return !!row;
}

export async function GET(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireShopAdmin(req);
    if (!auth) return forbidden();
    const { id } = await ctx.params;

    const [row, interestRows, preBookingRows] = await Promise.all([
      prisma.marketplaceProduct.findUnique({ where: { id }, select: ADMIN_PRODUCT_SELECT }),
      prisma.marketplaceInterest.findMany({
        where: { productId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          user: { select: { id: true, name: true, mobileNumber: true } },
        },
      }),
      // Everything, cancelled included: the store has usually already
      // acted on a row by the time it is called off, and a pre-booking
      // that disappears from the list is worse than one marked off.
      prisma.marketplacePreBooking.findMany({
        where: { productId: id },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          productId: true,
          productName: true,
          quantity: true,
          size: true,
          unitPrice: true,
          status: true,
          contactName: true,
          contactPhone: true,
          addressText: true,
          adminNote: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, name: true, mobileNumber: true } },
        },
      }),
    ]);
    if (!row) return notFound();

    const interests: MarketplaceInterestView[] = interestRows.map((r) => ({
      id: r.id,
      userId: r.user.id,
      name: r.user.name,
      mobileNumber: r.user.mobileNumber,
      createdAt: r.createdAt.toISOString(),
    }));

    const preBookings: MarketplacePreBookingView[] = preBookingRows.map((r) => ({
      id: r.id,
      productId: r.productId,
      productName: r.productName,
      quantity: r.quantity,
      size: r.size,
      unitPrice: r.unitPrice,
      status: r.status,
      userId: r.user.id,
      name: r.user.name,
      mobileNumber: r.user.mobileNumber,
      contactName: r.contactName,
      contactPhone: r.contactPhone,
      addressText: r.addressText,
      adminNote: r.adminNote,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return NextResponse.json({ product: toAdminProductView(row), interests, preBookings });
  } catch (error) {
    const { message, status } = sanitizeApiError(error, 'admin.shop.product.get');
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireShopAdmin(req);
    if (!auth) return forbidden();
    const { id } = await ctx.params;
    if (!(await productExists(id))) return notFound();

    const body = await readJson(req);
    if (body === undefined) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    const parsed = ProductInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Validation failed' },
        { status: 400 },
      );
    }

    const { specs, ...fields } = parsed.data;
    const updated = await prisma.marketplaceProduct.update({
      where: { id },
      data: { ...fields, specs: specs as Prisma.InputJsonValue },
      select: ADMIN_PRODUCT_SELECT,
    });
    return NextResponse.json(toAdminProductView(updated));
  } catch (error) {
    const { message, status } = sanitizeApiError(error, 'admin.shop.product.update');
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireShopAdmin(req);
    if (!auth) return forbidden();
    const { id } = await ctx.params;
    if (!(await productExists(id))) return notFound();

    await prisma.marketplaceProduct.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const { message, status } = sanitizeApiError(error, 'admin.shop.product.delete');
    return NextResponse.json({ error: message }, { status });
  }
}
