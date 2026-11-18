export type Hvac = "heat" | "fan" | "off";

export type Zone = {
  setpoint: number | null;
  mode: string | null;
  hvac: Hvac;
  fanMode: string | null;
};

export type HeatSnapshot = {
  recordedAt: string;
  kitchenF: number | null;
  loftF: number | null;
  kitchenRh: number | null;
  loftRh: number | null;
  outdoorF: number | null;
  upstairs: Zone;
  downstairs: Zone;
};

export type HeatDay = {
  date: string;
  upstairsHeatH: number;
  downstairsHeatH: number;
  upstairsCycles: number;
  downstairsCycles: number;
  outdoorLow: number | null;
  outdoorHigh: number | null;
  outdoorAvg: number | null;
  hdd65: number | null;
  estThermsLow: number | null;
  estThermsHigh: number | null;
  estCostLow: number | null;
  estCostHigh: number | null;
  ccfPerHdd: number | null;
};

export type HeatReview = {
  date: string;
  text: string;
};

export type HeatRows = {
  latest: HeatSnapshot | null;
  snapshots: HeatSnapshot[];
  days: HeatDay[];
  review: HeatReview | null;
};

export type HeatTotals = {
  label: string;
  from: string;
  to: string;
  upstairsHeatH: number;
  downstairsHeatH: number;
  costLow: number | null;
  costHigh: number | null;
  hdd65: number | null;
};

export type HeatSeriesPoint = {
  t: string;
  kitchenF: number | null;
  loftF: number | null;
  outdoorF: number | null;
  upstairsHeat: boolean;
  downstairsHeat: boolean;
};

export type HeatDayPoint = {
  date: string;
  upstairsHeatH: number;
  downstairsHeatH: number;
  costLow: number | null;
  costHigh: number | null;
  costMid: number | null;
  hdd65: number | null;
  ccfPerHdd: number | null;
  outdoorAvg: number | null;
};

export type HeatView = {
  generatedAt: string;
  sample: boolean;
  zone: string;
  latest: {
    recordedAt: string;
    ageSec: number;
    kitchenF: number | null;
    loftF: number | null;
    kitchenRh: number | null;
    loftRh: number | null;
    outdoorF: number | null;
    upstairs: Zone;
    downstairs: Zone;
  } | null;
  today: {
    date: string;
    costLow: number | null;
    costHigh: number | null;
    source: "reported" | "estimated" | "none";
    upstairsHeatH: number;
    downstairsHeatH: number;
  };
  series24h: HeatSeriesPoint[];
  days: HeatDayPoint[];
  week: HeatTotals;
  month: HeatTotals;
  ccf: {
    baseline: number;
    recentAvg: number | null;
    days: number;
    versusBaseline: number | null;
  };
  review: HeatReview | null;
};

export type HeatBatch = {
  snapshots: HeatSnapshot[];
  days: HeatDay[];
  reviews: HeatReview[];
};
