-- Add billingMode to RegularRun so runs can be billed either by mileage
-- (miles * rate, e.g. Wayne/Aramsco) or as a flat/weight-based charge
-- (e.g. Guadalupe, where the $ changes weekly with the weight limit).
-- Additive + idempotent — existing rows default to MILEAGE, no data touched.

ALTER TABLE "RegularRun"
  ADD COLUMN IF NOT EXISTS "billingMode" TEXT NOT NULL DEFAULT 'MILEAGE';
