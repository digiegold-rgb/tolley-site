-- Optional Airius loft-fan readings on each heat snapshot. Existing rows stay null.
ALTER TABLE "HeatSnapshot" ADD COLUMN "loftFanOn" BOOLEAN;
ALTER TABLE "HeatSnapshot" ADD COLUMN "loftFanW" DOUBLE PRECISION;
ALTER TABLE "HeatSnapshot" ADD COLUMN "loftFanEnergyWh" DOUBLE PRECISION;
ALTER TABLE "HeatSnapshot" ADD COLUMN "loftFanDecision" TEXT;
