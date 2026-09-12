-- W/D paid-signup auto-welcome: stamp once per client so webhook retries
-- and the three Stripe signup events cannot double-send SMS/email.
ALTER TABLE "WdClient" ADD COLUMN IF NOT EXISTS "welcomeSentAt" TIMESTAMP(3);
