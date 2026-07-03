-- Re-engagement email idempotency: track last send so the daily cron doesn't spam
-- a household. Additive only — never drop Food columns (real family data).

ALTER TABLE "FoodHousehold"
  ADD COLUMN "reengagementEmailSentAt" TIMESTAMP(3),
  ADD COLUMN "lastActiveAt"            TIMESTAMP(3);

CREATE INDEX "FoodHousehold_lastActiveAt_idx" ON "FoodHousehold"("lastActiveAt");
