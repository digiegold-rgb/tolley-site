-- W/D paid-signup auto-welcome: stamp once per client so webhook retries
-- and the three Stripe signup events cannot double-send SMS/email.
ALTER TABLE "WdClient" ADD COLUMN IF NOT EXISTS "welcomeSentAt" TIMESTAMP(3);

-- Dorothy Johnson (cus_VFPkiB9RKXHrep) was welcomed manually 2026-09-12
-- ~12:41 CT (SMS SMc8426e22b6d97ba7cbc8609a01fb06a1, email 1a096d6a31068fcc).
-- Seed welcome_sent so webhook retries / future events never re-send.
UPDATE "WdClient"
SET "welcomeSentAt" = COALESCE("welcomeSentAt", TIMESTAMP '2026-09-12 17:41:00')
WHERE "stripeCustomerId" = 'cus_VFPkiB9RKXHrep';

INSERT INTO "WdMessage" (
  "id", "clientId", "phone", "channel", "direction", "kind", "status",
  "subject", "body", "aiGenerated", "meta", "createdAt", "sentAt"
)
SELECT
  'wd-welcome-sms:' || c.id,
  c.id,
  c.phone,
  'sms',
  'outbound',
  'welcome',
  'sent',
  NULL,
  'Manual welcome 2026-09-12 — do not resend.',
  false,
  '{"manual": true, "twilioSid": "SMc8426e22b6d97ba7cbc8609a01fb06a1"}'::jsonb,
  TIMESTAMP '2026-09-12 17:41:00',
  TIMESTAMP '2026-09-12 17:41:00'
FROM "WdClient" c
WHERE c."stripeCustomerId" = 'cus_VFPkiB9RKXHrep'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "WdMessage" (
  "id", "clientId", "phone", "channel", "direction", "kind", "status",
  "subject", "body", "aiGenerated", "meta", "createdAt", "sentAt"
)
SELECT
  'wd-welcome-email:' || c.id,
  c.id,
  c.phone,
  'email',
  'outbound',
  'welcome',
  'sent',
  'Welcome to Tolley Washer & Dryer Rental — you''re all set',
  'Manual welcome 2026-09-12 — do not resend.',
  false,
  '{"manual": true, "emailId": "1a096d6a31068fcc"}'::jsonb,
  TIMESTAMP '2026-09-12 17:41:00',
  TIMESTAMP '2026-09-12 17:41:00'
FROM "WdClient" c
WHERE c."stripeCustomerId" = 'cus_VFPkiB9RKXHrep'
ON CONFLICT ("id") DO NOTHING;
