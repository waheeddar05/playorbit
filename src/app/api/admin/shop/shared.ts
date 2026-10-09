import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { canManageStore, getAuthenticatedUser, type AuthenticatedUser } from '@/lib/auth';
import { PRODUCT_SELECT, toProductView, type ProductRow } from '@/lib/marketplace-server';
import type { MarketplaceProductAdminView } from '@/lib/marketplace';

/**
 * Admin → Cricket Store is run by **store admins** (`User.isStoreAdmin`)
 * and super admins. The store is one catalog for all of PlayOrbit, so
 * this deliberately does NOT go through `requireCenterAdmin`: a center
 * admin or moderator has no say over it, whichever center they run. The
 * middleware keeps them off /admin/shop as a first layer; this is the
 * layer that counts.
 */
export async function requireShopAdmin(req: NextRequest): Promise<{ user: AuthenticatedUser } | null> {
  const user = await getAuthenticatedUser(req);
  if (!user || !canManageStore(user)) return null;
  return { user };
}

export const forbidden = () => NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

/**
 * Product row plus the two demand signals: "Notify me" taps, and
 * pre-bookings that are still waiting on us. Cancelled and collected
 * pre-bookings are excluded from the count — the number on the row is
 * meant to read as "people expecting a bat", which is what the store
 * acts on.
 */
export const ADMIN_PRODUCT_SELECT = {
  ...PRODUCT_SELECT,
  _count: {
    select: {
      interests: true,
      preBookings: { where: { status: { in: ['PENDING', 'CONFIRMED'] } } },
    },
  },
} satisfies Prisma.MarketplaceProductSelect;

export type AdminProductRow = Prisma.MarketplaceProductGetPayload<{ select: typeof ADMIN_PRODUCT_SELECT }>;

export function toAdminProductView(row: AdminProductRow): MarketplaceProductAdminView {
  const { _count, ...rest } = row;
  return {
    ...toProductView(rest as ProductRow),
    interestCount: _count.interests,
    preBookingCount: _count.preBookings,
  };
}

/** Parse a JSON body, or return undefined (caller answers 400). */
export async function readJson(req: NextRequest): Promise<unknown | undefined> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}
