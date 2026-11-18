-- Additive home-heat tables. No existing tables are changed.
CREATE TABLE "HeatSnapshot" (
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "kitchenF" DOUBLE PRECISION,
  "loftF" DOUBLE PRECISION,
  "kitchenRh" DOUBLE PRECISION,
  "loftRh" DOUBLE PRECISION,
  "outdoorF" DOUBLE PRECISION,
  "upSetpoint" DOUBLE PRECISION,
  "upMode" TEXT,
  "upHvac" TEXT NOT NULL,
  "upFanMode" TEXT,
  "downSetpoint" DOUBLE PRECISION,
  "downMode" TEXT,
  "downHvac" TEXT NOT NULL,
  "downFanMode" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HeatSnapshot_pkey" PRIMARY KEY ("recordedAt")
);

CREATE TABLE "HeatDay" (
  "date" TEXT NOT NULL,
  "upstairsHeatH" DOUBLE PRECISION NOT NULL,
  "downstairsHeatH" DOUBLE PRECISION NOT NULL,
  "upstairsCycles" INTEGER NOT NULL,
  "downstairsCycles" INTEGER NOT NULL,
  "outdoorLow" DOUBLE PRECISION,
  "outdoorHigh" DOUBLE PRECISION,
  "outdoorAvg" DOUBLE PRECISION,
  "hdd65" DOUBLE PRECISION,
  "estThermsLow" DOUBLE PRECISION,
  "estThermsHigh" DOUBLE PRECISION,
  "estCostLow" DOUBLE PRECISION,
  "estCostHigh" DOUBLE PRECISION,
  "ccfPerHdd" DOUBLE PRECISION,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HeatDay_pkey" PRIMARY KEY ("date")
);

CREATE TABLE "HeatReview" (
  "date" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HeatReview_pkey" PRIMARY KEY ("date")
);
