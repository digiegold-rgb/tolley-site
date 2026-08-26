-- Real flag for phones Twilio already bounced (30003 / 30005).
-- Additive columns; seed the four clients Jared already marked in notes.
ALTER TABLE "WdClient" ADD COLUMN IF NOT EXISTS "smsUndeliverable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WdClient" ADD COLUMN IF NOT EXISTS "smsUndeliverableAt" TIMESTAMP(3);
ALTER TABLE "WdClient" ADD COLUMN IF NOT EXISTS "smsErrorCode" TEXT;

UPDATE "WdClient"
SET
  "smsUndeliverable" = true,
  "smsUndeliverableAt" = TIMESTAMP '2026-08-26 00:00:00',
  "smsErrorCode" = '30003'
WHERE id IN (
  'cmmobyxk3005al4h1tq7uuhxm',
  'cmmobyx5p0044l4h1xn2v4q0m'
);

UPDATE "WdClient"
SET
  "smsUndeliverable" = true,
  "smsUndeliverableAt" = TIMESTAMP '2026-08-26 00:00:00',
  "smsErrorCode" = '30005'
WHERE id IN (
  'cmmobyx0z003vl4h12w08r3cm',
  'cmmobyx3c0040l4h1smcwncqz'
);
