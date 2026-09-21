-- Pre-bookings for the Cricket Store.
--
-- Before launch the store could only collect "Notify me" rows, which are
-- a mailing list: no quantity, no size, no address, nothing anybody
-- promised. A pre-booking is the commitment itself — the customer asks
-- us to hold one, we record it, nobody pays. The row is the whole
-- transaction, so it carries a snapshot of what was promised (product
-- name, unit price, delivery address) rather than reading those through
-- the relations, where a later catalog edit or a changed address would
-- silently rewrite history.
--
-- Written to be re-runnable: every statement guards itself, because
-- `prisma migrate deploy` runs on every build and this schema has been
-- reconciled by hand before (see scripts/reconcile-migrations.mjs).

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "PreBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FULFILLED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "MarketplacePreBooking" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "size" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "addressText" TEXT,
    "status" "PreBookingStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplacePreBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: the store's own list, newest first, per product.
CREATE INDEX IF NOT EXISTS "MarketplacePreBooking_productId_createdAt_idx" ON "MarketplacePreBooking"("productId", "createdAt");

-- CreateIndex: "what have I pre-booked" on the customer's side.
CREATE INDEX IF NOT EXISTS "MarketplacePreBooking_userId_createdAt_idx" ON "MarketplacePreBooking"("userId", "createdAt");

-- CreateIndex: working the queue — everything still PENDING.
CREATE INDEX IF NOT EXISTS "MarketplacePreBooking_status_createdAt_idx" ON "MarketplacePreBooking"("status", "createdAt");

-- CreateIndex: one standing pre-booking per person per product. Tapping
-- again revises the quantity instead of queuing a second bat.
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplacePreBooking_productId_userId_key" ON "MarketplacePreBooking"("productId", "userId");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "MarketplacePreBooking" ADD CONSTRAINT "MarketplacePreBooking_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "MarketplacePreBooking" ADD CONSTRAINT "MarketplacePreBooking_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
