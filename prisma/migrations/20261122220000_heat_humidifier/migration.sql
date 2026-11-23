-- Optional whole-home humidifier readings (two Honeywell HE360 units on one Shelly relay). Existing rows stay null.
ALTER TABLE "HeatSnapshot" ADD COLUMN "humidOn" BOOLEAN;
ALTER TABLE "HeatSnapshot" ADD COLUMN "humidTargetRh" DOUBLE PRECISION;
ALTER TABLE "HeatSnapshot" ADD COLUMN "humidTodayH" DOUBLE PRECISION;
ALTER TABLE "HeatSnapshot" ADD COLUMN "humidDecision" TEXT;
ALTER TABLE "HeatDay" ADD COLUMN "humidOnH" DOUBLE PRECISION;
ALTER TABLE "HeatDay" ADD COLUMN "humidCycles" INTEGER;
ALTER TABLE "HeatDay" ADD COLUMN "humidKwh" DOUBLE PRECISION;
ALTER TABLE "HeatDay" ADD COLUMN "humidCost" DOUBLE PRECISION;
ALTER TABLE "HeatDay" ADD COLUMN "humidWaterGal" DOUBLE PRECISION;
