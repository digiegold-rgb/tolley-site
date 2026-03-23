/**
 * Pool water chemistry calculations.
 * LSI, dosing formulas, FC/CYA relationship, weather impact predictions.
 */

// ─── LSI (Langelier Saturation Index) ────────────────────────

/** Temperature factor lookup (°F → factor) */
const TEMP_FACTORS: [number, number][] = [
  [32, 0.0], [37, 0.1], [46, 0.2], [53, 0.3], [60, 0.4],
  [66, 0.5], [76, 0.6], [84, 0.7], [94, 0.8], [105, 0.9],
];

/** Calcium hardness factor lookup */
const CH_FACTORS: [number, number][] = [
  [5, 0.3], [25, 1.0], [50, 1.3], [75, 1.5], [100, 1.6],
  [150, 1.8], [200, 1.9], [250, 2.0], [300, 2.1], [400, 2.2],
  [600, 2.4], [800, 2.5], [1000, 2.6],
];

/** Alkalinity factor lookup */
const ALK_FACTORS: [number, number][] = [
  [5, 0.7], [25, 1.4], [50, 1.7], [75, 1.9], [100, 2.0],
  [125, 2.1], [150, 2.2], [200, 2.3], [250, 2.4], [300, 2.5],
  [400, 2.6], [500, 2.7], [600, 2.8], [800, 2.9],
];

/** TDS factor lookup */
const TDS_FACTORS: [number, number][] = [
  [0, 12.0], [400, 12.1], [800, 12.2], [1200, 12.3],
  [2000, 12.4], [4000, 12.5], [6000, 12.6], [10000, 12.7],
];

function interpolateFactor(table: [number, number][], value: number): number {
  if (value <= table[0][0]) return table[0][1];
  if (value >= table[table.length - 1][0]) return table[table.length - 1][1];
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i];
    const [x1, y1] = table[i + 1];
    if (value >= x0 && value <= x1) {
      const t = (value - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return table[0][1];
}

export interface LSIParams {
  ph: number;
  temperature: number; // °F
  calciumHardness: number;
  alkalinity: number;
  tds?: number;
}

export function calculateLSI(p: LSIParams): number {
  const tf = interpolateFactor(TEMP_FACTORS, p.temperature);
  const cf = interpolateFactor(CH_FACTORS, p.calciumHardness);
  const af = interpolateFactor(ALK_FACTORS, p.alkalinity);
  const tdsf = interpolateFactor(TDS_FACTORS, p.tds ?? 1000);
  return +(p.ph + tf + cf + af - tdsf).toFixed(2);
}

export function interpretLSI(lsi: number): { label: string; status: "good" | "warning" | "critical" } {
  if (lsi >= -0.3 && lsi <= 0.3) return { label: "Balanced", status: "good" };
  if (lsi > 0.3 && lsi <= 0.5) return { label: "Slightly scale-forming", status: "warning" };
  if (lsi < -0.3 && lsi >= -0.5) return { label: "Slightly corrosive", status: "warning" };
  if (lsi > 0.5) return { label: "Scale-forming — lower pH or alkalinity", status: "critical" };
  return { label: "Corrosive — raise pH, alkalinity, or calcium", status: "critical" };
}

// ─── FC/CYA Relationship ────────────────────────────────────

/** Ideal FC for a given CYA level (saltwater: ~7.5% of CYA) */
export function idealFC(cya: number): number {
  return +(cya * 0.075).toFixed(1);
}

/** Minimum FC for a given CYA level (~5% of CYA, TFP standard) */
export function minFC(cya: number): number {
  return +(cya * 0.05).toFixed(1);
}

/** SLAM level FC for a given CYA (40% of CYA) */
export function slamFC(cya: number): number {
  return +(cya * 0.4).toFixed(1);
}

// ─── Dosing Calculations ────────────────────────────────────

export interface DosingResult {
  chemical: string;
  amount: number;
  unit: string;
  instruction: string;
}

type DosingParam = "ph_down" | "ph_up" | "alkalinity" | "cya" | "salt" | "calciumHardness" | "freeChlorine" | "shock";

/**
 * Calculate dosing for a given parameter change.
 * All rates are per 10,000 gallons.
 */
export function calculateDosing(
  param: DosingParam,
  current: number,
  target: number,
  poolGallons: number = 48_000,
): DosingResult | null {
  const factor = poolGallons / 10_000;
  const diff = target - current;
  if (Math.abs(diff) < 0.01) return null;

  switch (param) {
    case "ph_down": {
      // Muriatic acid 31.45%: 25.6 fl oz per 10k gal lowers pH by 0.2
      const steps = (current - target) / 0.2;
      if (steps <= 0) return null;
      const oz = 25.6 * steps * factor;
      return {
        chemical: "Muriatic Acid (31.45%)",
        amount: +oz.toFixed(1),
        unit: "fl oz",
        instruction: `Add ${oz.toFixed(1)} fl oz muriatic acid to lower pH from ${current} to ${target}. Pour into deep end with pump running. Wait 30 min, retest.`,
      };
    }
    case "ph_up": {
      // Soda ash: 6 oz per 10k gal raises pH by 0.2
      const steps = (target - current) / 0.2;
      if (steps <= 0) return null;
      const oz = 6 * steps * factor;
      return {
        chemical: "Soda Ash (pH Up)",
        amount: +oz.toFixed(1),
        unit: "oz",
        instruction: `Add ${oz.toFixed(1)} oz soda ash to raise pH from ${current} to ${target}. Pre-dissolve in bucket of pool water. Add slowly to pool.`,
      };
    }
    case "alkalinity": {
      // Baking soda: 1.5 lb per 10k gal raises TA by 10 ppm
      const ppmChange = diff;
      if (ppmChange <= 0) return null;
      const lbs = (ppmChange / 10) * 1.5 * factor;
      return {
        chemical: "Baking Soda (Sodium Bicarbonate)",
        amount: +lbs.toFixed(1),
        unit: "lbs",
        instruction: `Add ${lbs.toFixed(1)} lbs baking soda to raise alkalinity from ${current} to ${target} ppm. Broadcast across surface with pump running.`,
      };
    }
    case "cya": {
      // Stabilizer: 13 oz per 10k gal raises CYA by 10 ppm
      const ppmChange = diff;
      if (ppmChange <= 0) return null;
      const oz = (ppmChange / 10) * 13 * factor;
      return {
        chemical: "Cyanuric Acid (Stabilizer)",
        amount: +oz.toFixed(1),
        unit: "oz",
        instruction: `Add ${oz.toFixed(1)} oz stabilizer to raise CYA from ${current} to ${target} ppm. Add to skimmer sock or dissolve slowly. Takes 3-7 days to fully register.`,
      };
    }
    case "salt": {
      // 30 lbs per 10k gal raises salt by ~480 ppm
      const ppmChange = diff;
      if (ppmChange <= 0) return null;
      const lbs = (ppmChange / 480) * 30 * factor;
      const bags = lbs / 40; // 40lb bags
      return {
        chemical: "Pool Salt (40lb bags)",
        amount: +lbs.toFixed(0),
        unit: "lbs",
        instruction: `Add ${lbs.toFixed(0)} lbs salt (~${bags.toFixed(1)} bags) to raise salt from ${current} to ${target} ppm. Broadcast evenly across pool. Run pump 24hrs. Retest in 24hrs.`,
      };
    }
    case "calciumHardness": {
      // Calcium chloride: 1.25 lb per 10k gal raises CH by 10 ppm
      const ppmChange = diff;
      if (ppmChange <= 0) return null;
      const lbs = (ppmChange / 10) * 1.25 * factor;
      return {
        chemical: "Calcium Chloride",
        amount: +lbs.toFixed(1),
        unit: "lbs",
        instruction: `Add ${lbs.toFixed(1)} lbs calcium chloride to raise calcium hardness from ${current} to ${target} ppm. Pre-dissolve in bucket. Add slowly in front of return jet.`,
      };
    }
    case "freeChlorine": {
      // Liquid chlorine 12.5%: 10 fl oz per 10k gal raises FC by 1 ppm
      const ppmChange = diff;
      if (ppmChange <= 0) return null;
      const oz = ppmChange * 10 * factor;
      return {
        chemical: "Liquid Chlorine (12.5%)",
        amount: +oz.toFixed(1),
        unit: "fl oz",
        instruction: `Add ${oz.toFixed(1)} fl oz (${(oz / 128).toFixed(1)} gal) liquid chlorine to raise FC from ${current} to ${target} ppm. Pour around perimeter at dusk.`,
      };
    }
    case "shock": {
      // Cal-hypo: 1 lb per 10k gal raises FC by ~10 ppm
      const ppmChange = diff;
      if (ppmChange <= 0) return null;
      const lbs = (ppmChange / 10) * 1 * factor;
      return {
        chemical: "Cal-Hypo Shock (65%)",
        amount: +lbs.toFixed(1),
        unit: "lbs",
        instruction: `Add ${lbs.toFixed(1)} lbs cal-hypo shock to raise FC by ${ppmChange} ppm. Pre-dissolve in bucket. Add at dusk. Do not swim until FC drops below 5 ppm.`,
      };
    }
    default:
      return null;
  }
}

// ─── Auto-recommendations ───────────────────────────────────

export interface DosingRecommendation extends DosingResult {
  param: string;
  priority: "high" | "medium" | "low";
}

export function getDosingRecommendations(reading: {
  ph?: number | null;
  freeChlorine?: number | null;
  alkalinity?: number | null;
  cya?: number | null;
  salt?: number | null;
  calciumHardness?: number | null;
}, poolGallons: number = 48_000): DosingRecommendation[] {
  const recs: DosingRecommendation[] = [];

  // pH
  if (reading.ph != null) {
    if (reading.ph > 7.6) {
      const r = calculateDosing("ph_down", reading.ph, 7.4, poolGallons);
      if (r) recs.push({ ...r, param: "pH", priority: reading.ph > 7.8 ? "high" : "medium" });
    } else if (reading.ph < 7.2) {
      const r = calculateDosing("ph_up", reading.ph, 7.4, poolGallons);
      if (r) recs.push({ ...r, param: "pH", priority: reading.ph < 7.0 ? "high" : "medium" });
    }
  }

  // FC (relative to CYA)
  if (reading.freeChlorine != null && reading.cya != null) {
    const target = idealFC(reading.cya);
    if (reading.freeChlorine < minFC(reading.cya)) {
      const r = calculateDosing("freeChlorine", reading.freeChlorine, target, poolGallons);
      if (r) recs.push({ ...r, param: "Free Chlorine", priority: "high" });
    }
  } else if (reading.freeChlorine != null && reading.freeChlorine < 2) {
    const r = calculateDosing("freeChlorine", reading.freeChlorine, 3, poolGallons);
    if (r) recs.push({ ...r, param: "Free Chlorine", priority: "high" });
  }

  // Alkalinity
  if (reading.alkalinity != null && reading.alkalinity < 80) {
    const r = calculateDosing("alkalinity", reading.alkalinity, 100, poolGallons);
    if (r) recs.push({ ...r, param: "Alkalinity", priority: reading.alkalinity < 60 ? "high" : "medium" });
  }

  // CYA
  if (reading.cya != null && reading.cya < 30) {
    const r = calculateDosing("cya", reading.cya, 50, poolGallons);
    if (r) recs.push({ ...r, param: "CYA", priority: reading.cya < 20 ? "high" : "medium" });
  }

  // Salt
  if (reading.salt != null && reading.salt < 2700) {
    const r = calculateDosing("salt", reading.salt, 3200, poolGallons);
    if (r) recs.push({ ...r, param: "Salt", priority: reading.salt < 2400 ? "high" : "medium" });
  }

  // Calcium Hardness
  if (reading.calciumHardness != null && reading.calciumHardness < 200) {
    const r = calculateDosing("calciumHardness", reading.calciumHardness, 300, poolGallons);
    if (r) recs.push({ ...r, param: "Calcium Hardness", priority: "low" });
  }

  return recs.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return p[a.priority] - p[b.priority];
  });
}

// ─── Weather Impact ─────────────────────────────────────────

export interface WeatherImpact {
  parameter: string;
  direction: "increase" | "decrease";
  severity: "low" | "medium" | "high";
  recommendation: string;
}

export function predictWeatherImpact(weather: {
  uvIndex: number;
  tempHigh: number;
  precipMm: number;
  windSpeed: number;
}): WeatherImpact[] {
  const impacts: WeatherImpact[] = [];

  if (weather.uvIndex >= 8) {
    impacts.push({
      parameter: "Free Chlorine",
      direction: "decrease",
      severity: weather.uvIndex >= 10 ? "high" : "medium",
      recommendation: `High UV (${weather.uvIndex}) will burn off chlorine faster. Ensure CYA is 50+ ppm. Consider running SCG at higher output.`,
    });
  }

  if (weather.precipMm >= 10) {
    impacts.push({
      parameter: "Alkalinity",
      direction: "decrease",
      severity: weather.precipMm >= 25 ? "high" : "medium",
      recommendation: `Rain (${weather.precipMm.toFixed(0)}mm expected) dilutes chemicals and lowers alkalinity. Test and adjust TA after rain stops.`,
    });
    impacts.push({
      parameter: "pH",
      direction: "decrease",
      severity: "medium",
      recommendation: "Rainwater is acidic (pH ~5.6). Expect pH drop. Retest after rain.",
    });
  }

  if (weather.tempHigh >= 90) {
    impacts.push({
      parameter: "Algae Risk",
      direction: "increase",
      severity: weather.tempHigh >= 100 ? "high" : "medium",
      recommendation: `High temps (${weather.tempHigh}°F) promote algae growth. Keep FC at upper range. Brush walls and run pump longer.`,
    });
  }

  if (weather.windSpeed >= 20) {
    impacts.push({
      parameter: "Debris",
      direction: "increase",
      severity: "low",
      recommendation: `Windy conditions (${weather.windSpeed.toFixed(0)} mph). Check skimmer baskets. Debris increases chlorine demand.`,
    });
  }

  return impacts;
}
