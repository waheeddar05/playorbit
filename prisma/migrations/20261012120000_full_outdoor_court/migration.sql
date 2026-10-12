-- Full Outdoor Court: the outdoor twin of the Full Indoor Court booking
-- category. It takes every natural-turf wicket at a center instead of
-- every indoor (Astro) net; nothing else about the booking differs.
--
-- Appended to both enums so every stored value is untouched. The ledger
-- revenue enum mirrors BookingCategory one-for-one (see ledger.ts), so it
-- gains the same value. IF NOT EXISTS keeps the migration re-runnable.
ALTER TYPE "BookingCategory" ADD VALUE IF NOT EXISTS 'FULL_OUTDOOR_COURT';
ALTER TYPE "LedgerRevenueCategory" ADD VALUE IF NOT EXISTS 'FULL_OUTDOOR_COURT';
