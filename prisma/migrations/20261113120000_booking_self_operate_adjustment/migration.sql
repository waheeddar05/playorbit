-- Self-operate price adjustment: the signed ₹ a center's
-- RESOURCE_PRICING_CONFIG.selfOperateAdjustment moved a machine booking's
-- per-slot rate by when the player picked Self Operate. Already included
-- in "originalPrice" / "price"; stored so the row decomposes. Nullable and
-- additive, so every existing row is untouched. IF NOT EXISTS keeps the
-- migration re-runnable.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "selfOperateAdjustment" DOUBLE PRECISION;
