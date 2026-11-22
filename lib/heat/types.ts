export type Hvac = "heat" | "fan" | "off";

export type Zone = {
  setpoint: number | null;
  mode: string | null;
  hvac: Hvac;
  fanMode: string | null;
};

/** Airius loft fan on the Shelly plug. Nulls mean this snapshot did not report the fan. */
export type LoftFanReading = {
  on: boolean | null;
  watts: number | null;
  energyWh: number | null;
  decision: string | null;
};

export const EMPTY_LOFT_FAN: LoftFanReading = {
  on: null,
  watts: null,
  energyWh: null,
  decision: null,
};

/** Whole-home humidifier relay. Optional: older snapshots did not report it. */
export type HumidReading = {
  on: boolean | null;
  targetRh: number | null;
  /** Spark's running relay-on hours for this Chicago day. */
  todayH: number | null;
  decision: string | null;
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
  loftFan: LoftFanReading;
  humid?: HumidReading;
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
  humidOnH?: number | null;
  humidCycles?: number | null;
  humidKwh?: number | null;
  humidCost?: number | null;
  humidWaterGal?: number | null;
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
  /** Loft-fan electricity added into costLow / costHigh when fanCost is above zero. */
  fanRuntimeH: number;
  fanKwh: number | null;
  fanCost: number | null;
  /** Humidifier electricity, also added into costLow / costHigh when above zero. */
  humidRuntimeH: number;
  humidKwh: number | null;
  humidCost: number | null;
};

export type HumidDayPoint = {
  date: string;
  runtimeH: number;
  cycles: number | null;
  kwh: number | null;
  cost: number | null;
  waterGal: number | null;
};

export type HumidView = {
  hasData: boolean;
  units: number;
  watts: number;
  rateUsdPerKwh: number;
  now: {
    on: boolean | null;
    targetRh: number | null;
    decision: string | null;
    rh: number | null;
    recordedAt: string;
  } | null;
  today: HumidDayPoint & { source: "live" | "reported" | "estimated" | "none" };
  days: HumidDayPoint[];
};

export type FanEnergySource = "meter" | "watts" | "nameplate" | "none";

export type FanDayPoint = {
  date: string;
  runtimeH: number;
  cycles: number;
  kwh: number | null;
  cost: number | null;
  source: FanEnergySource;
};

export type FanEffectPoint = {
  t: string;
  kitchenF: number | null;
  loftF: number | null;
  /** Loft minus kitchen. Positive means the loft is warmer. */
  gapF: number | null;
  fanOn: boolean | null;
};

export type LoftFanView = {
  hasData: boolean;
  rateUsdPerKwh: number;
  nameplateW: number;
  now: { on: boolean | null; watts: number | null; decision: string | null } | null;
  today: FanDayPoint;
  days: FanDayPoint[];
  series: FanEffectPoint[];
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
    /** Gas only. The card shows energyCostLow / energyCostHigh, which add the loft fan. */
    costLow: number | null;
    costHigh: number | null;
    energyCostLow: number | null;
    energyCostHigh: number | null;
    source: "reported" | "estimated" | "none";
    upstairsHeatH: number;
    downstairsHeatH: number;
  };
  fan: LoftFanView;
  humid: HumidView;
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
