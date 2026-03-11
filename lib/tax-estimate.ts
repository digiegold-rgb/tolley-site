/**
 * KC Metro County Tax Estimation Engine
 *
 * Determines county from lat/lng, estimates property taxes based on
 * county-specific assessment ratios and levy rates.
 *
 * Missouri: Residential assessed at 19% of market value
 * Kansas: Residential assessed at 11.5% of market value
 * Rates are approximate 2024/2025 mill levies.
 */

interface CountyBounds {
  name: string;
  state: "MO" | "KS";
  fips: string;
  /** Approximate polygon bounds [minLat, minLng, maxLat, maxLng] */
  bbox: [number, number, number, number];
  /** More precise: array of [lat, lng] polygon vertices (optional) */
  polygon?: [number, number][];
  /** Assessment ratio (decimal): MO residential = 0.19, KS residential = 0.115 */
  assessmentRatio: number;
  /** Total levy rate per $100 of assessed value */
  levyPer100: number;
  /** Approximate median home value for context */
  medianHomeValue: number;
}

const KC_COUNTIES: CountyBounds[] = [
  // Missouri counties
  {
    name: "Jackson County",
    state: "MO",
    fips: "29095",
    bbox: [38.82, -94.61, 39.32, -94.11],
    assessmentRatio: 0.19,
    levyPer100: 8.52,
    medianHomeValue: 195000,
  },
  {
    name: "Clay County",
    state: "MO",
    fips: "29047",
    bbox: [39.21, -94.61, 39.62, -94.21],
    assessmentRatio: 0.19,
    levyPer100: 7.83,
    medianHomeValue: 230000,
  },
  {
    name: "Platte County",
    state: "MO",
    fips: "29165",
    bbox: [39.21, -95.11, 39.62, -94.52],
    assessmentRatio: 0.19,
    levyPer100: 6.48,
    medianHomeValue: 275000,
  },
  {
    name: "Cass County",
    state: "MO",
    fips: "29037",
    bbox: [38.38, -94.61, 38.82, -94.06],
    assessmentRatio: 0.19,
    levyPer100: 7.15,
    medianHomeValue: 215000,
  },
  {
    name: "Ray County",
    state: "MO",
    fips: "29177",
    bbox: [39.21, -94.11, 39.62, -93.51],
    assessmentRatio: 0.19,
    levyPer100: 5.92,
    medianHomeValue: 160000,
  },
  {
    name: "Lafayette County",
    state: "MO",
    fips: "29107",
    bbox: [38.82, -94.11, 39.21, -93.51],
    assessmentRatio: 0.19,
    levyPer100: 5.45,
    medianHomeValue: 145000,
  },
  // Kansas counties
  {
    name: "Johnson County",
    state: "KS",
    fips: "20091",
    bbox: [38.72, -95.06, 39.05, -94.61],
    assessmentRatio: 0.115,
    levyPer100: 12.15,
    medianHomeValue: 340000,
  },
  {
    name: "Wyandotte County",
    state: "KS",
    fips: "20209",
    bbox: [39.05, -94.91, 39.32, -94.61],
    assessmentRatio: 0.115,
    levyPer100: 14.22,
    medianHomeValue: 135000,
  },
  {
    name: "Leavenworth County",
    state: "KS",
    fips: "20103",
    bbox: [39.05, -95.18, 39.56, -94.91],
    assessmentRatio: 0.115,
    levyPer100: 13.05,
    medianHomeValue: 195000,
  },
  {
    name: "Miami County",
    state: "KS",
    fips: "20121",
    bbox: [38.38, -95.06, 38.72, -94.61],
    assessmentRatio: 0.115,
    levyPer100: 11.80,
    medianHomeValue: 220000,
  },
];

export interface CountyTaxResult {
  countyName: string | null;
  countyFips: string | null;
  countyState: string | null;
  assessmentRatio: number | null;
  levyPer100: number | null;
  assessedValue: number | null;
  estimatedAnnualTax: number | null;
  estimatedMonthlyTax: number | null;
  effectiveTaxRate: number | null; // as percentage of market value
  medianHomeValue: number | null;
  taxBurdenRating: string | null; // "low", "moderate", "high", "very_high"
}

/**
 * Detect which KC metro county a property is in based on lat/lng.
 */
export function detectCounty(lat: number, lng: number): CountyBounds | null {
  for (const county of KC_COUNTIES) {
    const [minLat, minLng, maxLat, maxLng] = county.bbox;
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      return county;
    }
  }
  return null;
}

/**
 * Estimate property taxes for a listing.
 */
export function estimateTax(
  lat: number,
  lng: number,
  listPrice: number | null
): CountyTaxResult {
  const county = detectCounty(lat, lng);

  if (!county) {
    return {
      countyName: null,
      countyFips: null,
      countyState: null,
      assessmentRatio: null,
      levyPer100: null,
      assessedValue: null,
      estimatedAnnualTax: null,
      estimatedMonthlyTax: null,
      effectiveTaxRate: null,
      medianHomeValue: null,
      taxBurdenRating: null,
    };
  }

  const marketValue = listPrice || county.medianHomeValue;
  const assessedValue = Math.round(marketValue * county.assessmentRatio);
  const annualTax = Math.round((assessedValue / 100) * county.levyPer100);
  const monthlyTax = Math.round(annualTax / 12);
  const effectiveRate = (annualTax / marketValue) * 100;

  let taxBurdenRating: string;
  if (effectiveRate <= 1.0) taxBurdenRating = "low";
  else if (effectiveRate <= 1.5) taxBurdenRating = "moderate";
  else if (effectiveRate <= 2.0) taxBurdenRating = "high";
  else taxBurdenRating = "very_high";

  return {
    countyName: county.name,
    countyFips: county.fips,
    countyState: county.state,
    assessmentRatio: county.assessmentRatio,
    levyPer100: county.levyPer100,
    assessedValue,
    estimatedAnnualTax: annualTax,
    estimatedMonthlyTax: monthlyTax,
    effectiveTaxRate: Math.round(effectiveRate * 100) / 100,
    medianHomeValue: county.medianHomeValue,
    taxBurdenRating,
  };
}
