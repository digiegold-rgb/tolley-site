-- FoodActivityEvent: lightweight funnel telemetry for Ruthann's Kitchen
-- Additive only. Captures key UX transitions so admin can see where users drop.

CREATE TABLE "FoodActivityEvent" (
  "id"          TEXT       NOT NULL,
  "householdId" TEXT       NOT NULL,
  "kind"        TEXT       NOT NULL,
  "meta"        JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FoodActivityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FoodActivityEvent_householdId_idx"           ON "FoodActivityEvent"("householdId");
CREATE INDEX "FoodActivityEvent_kind_idx"                  ON "FoodActivityEvent"("kind");
CREATE INDEX "FoodActivityEvent_householdId_createdAt_idx" ON "FoodActivityEvent"("householdId", "createdAt" DESC);

ALTER TABLE "FoodActivityEvent"
  ADD CONSTRAINT "FoodActivityEvent_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "FoodHousehold"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
