/**
 * Listing Enrichment Engine
 *
 * Calculates proximity to POIs, county/tax data, and generates buy-side scores.
 * Buy score = location desirability (0-100).
 * Sell score = seller motivation (from lead-scoring.ts).
 */

import { haversineKm, kmToMiles } from "./poi";
import { estimateTax, type CountyTaxResult } from "./tax-estimate";

interface POIRecord {
  type: string;
  name: string | null;
  lat: number;
  lng: number;
}

interface NearestResult {
  dist: number; // km
  name: string | null;
}

function findNearest(
  lat: number,
  lng: number,
  pois: POIRecord[]
): NearestResult | null {
  if (pois.length === 0) return null;

  let minDist = Infinity;
  let nearest: POIRecord | null = null;

  for (const poi of pois) {
    const d = haversineKm(lat, lng, poi.lat, poi.lng);
    if (d < minDist) {
      minDist = d;
      nearest = poi;
    }
  }

  return nearest ? { dist: minDist, name: nearest.name } : null;
}

function countWithinRadius(
  lat: number,
  lng: number,
  pois: POIRecord[],
  radiusKm: number
): number {
  let count = 0;
  for (const poi of pois) {
    if (haversineKm(lat, lng, poi.lat, poi.lng) <= radiusKm) {
      count++;
    }
  }
  return count;
}

export interface EnrichmentResult {
  // POI proximity
  nearestSchoolDist: number | null;
  nearestSchoolName: string | null;
  schoolsWithin3mi: number;
  nearestHospitalDist: number | null;
  nearestHospitalName: string | null;
  nearestFireStationDist: number | null;
  nearestPoliceDist: number | null;
  nearestParkDist: number | null;
  nearestParkName: string | null;
  parksWithin2mi: number;
  nearestGroceryDist: number | null;
  nearestGroceryName: string | null;
  nearestMallDist: number | null;
  nearestAirportDist: number | null;
  nearestAirportName: string | null;
  nearestSportsDist: number | null;
  restaurantsWithin1mi: number;
  nearestCourthouseDist: number | null;
  nearestCourthouseName: string | null;
  nearestLibraryDist: number | null;
  nearestLibraryName: string | null;
  librariesWithin3mi: number;
  // County & Tax
  countyName: string | null;
  countyFips: string | null;
  countyState: string | null;
  assessmentRatio: number | null;
  levyPer100: number | null;
  assessedValue: number | null;
  estimatedAnnualTax: number | null;
  estimatedMonthlyTax: number | null;
  effectiveTaxRate: number | null;
  taxBurdenRating: string | null;
  // Score
  buyScore: number;
  buyScoreFactors: Record<string, number>;
}

/**
 * Enrich a single listing with POI proximity, county/tax data, and buy-side score.
 */
export function enrichListing(
  lat: number,
  lng: number,
  poisByType: Map<string, POIRecord[]>,
  listPrice?: number | null
): EnrichmentResult {
  const school = findNearest(lat, lng, poisByType.get("school") || []);
  const hospital = findNearest(lat, lng, poisByType.get("hospital") || []);
  const fireStation = findNearest(lat, lng, poisByType.get("fire_station") || []);
  const police = findNearest(lat, lng, poisByType.get("police") || []);
  const park = findNearest(lat, lng, poisByType.get("park") || []);
  const grocery = findNearest(lat, lng, poisByType.get("grocery") || []);
  const mall = findNearest(lat, lng, poisByType.get("mall") || []);
  const airport = findNearest(lat, lng, poisByType.get("airport") || []);
  const sports = findNearest(lat, lng, poisByType.get("sports") || []);
  const courthouse = findNearest(lat, lng, poisByType.get("courthouse") || []);
  const library = findNearest(lat, lng, poisByType.get("library") || []);

  const mi3 = 4.828; // 3 miles in km
  const mi2 = 3.219;
  const mi1 = 1.609;

  const schoolsWithin3mi = countWithinRadius(lat, lng, poisByType.get("school") || [], mi3);
  const parksWithin2mi = countWithinRadius(lat, lng, poisByType.get("park") || [], mi2);
  const restaurantsWithin1mi = countWithinRadius(lat, lng, poisByType.get("restaurant") || [], mi1);
  const librariesWithin3mi = countWithinRadius(lat, lng, poisByType.get("library") || [], mi3);

  // County + tax estimation
  const tax: CountyTaxResult = estimateTax(lat, lng, listPrice ?? null);

  // --- Buy Score Calculation (0-100) ---
  const factors: Record<string, number> = {};
  let buyScore = 0;

  // Schools (max 20 pts)
  if (school) {
    const mi = kmToMiles(school.dist);
    if (mi <= 1) { factors.school = 20; buyScore += 20; }
    else if (mi <= 2) { factors.school = 15; buyScore += 15; }
    else if (mi <= 5) { factors.school = 10; buyScore += 10; }
    else if (mi <= 10) { factors.school = 5; buyScore += 5; }
  }

  // Hospital (max 15 pts)
  if (hospital) {
    const mi = kmToMiles(hospital.dist);
    if (mi <= 3) { factors.hospital = 15; buyScore += 15; }
    else if (mi <= 5) { factors.hospital = 12; buyScore += 12; }
    else if (mi <= 10) { factors.hospital = 8; buyScore += 8; }
    else if (mi <= 15) { factors.hospital = 4; buyScore += 4; }
  }

  // Fire station (max 8 pts) — response time proxy (reduced from 10 to make room for tax/library)
  if (fireStation) {
    const mi = kmToMiles(fireStation.dist);
    if (mi <= 2) { factors.fireStation = 8; buyScore += 8; }
    else if (mi <= 5) { factors.fireStation = 6; buyScore += 6; }
    else if (mi <= 8) { factors.fireStation = 3; buyScore += 3; }
  }

  // Police (max 5 pts)
  if (police) {
    const mi = kmToMiles(police.dist);
    if (mi <= 3) { factors.police = 5; buyScore += 5; }
    else if (mi <= 5) { factors.police = 3; buyScore += 3; }
  }

  // Parks (max 12 pts) (reduced from 15 to make room)
  if (park) {
    const mi = kmToMiles(park.dist);
    if (mi <= 0.5) { factors.park = 8; buyScore += 8; }
    else if (mi <= 1) { factors.park = 6; buyScore += 6; }
    else if (mi <= 2) { factors.park = 4; buyScore += 4; }
  }
  if (parksWithin2mi >= 5) { factors.parkDensity = 4; buyScore += 4; }
  else if (parksWithin2mi >= 3) { factors.parkDensity = 2; buyScore += 2; }

  // Grocery (max 10 pts)
  if (grocery) {
    const mi = kmToMiles(grocery.dist);
    if (mi <= 1) { factors.grocery = 10; buyScore += 10; }
    else if (mi <= 2) { factors.grocery = 8; buyScore += 8; }
    else if (mi <= 5) { factors.grocery = 5; buyScore += 5; }
  }

  // Mall / Shopping (max 4 pts)
  if (mall) {
    const mi = kmToMiles(mall.dist);
    if (mi <= 5) { factors.mall = 4; buyScore += 4; }
    else if (mi <= 10) { factors.mall = 2; buyScore += 2; }
  }

  // Airport (max 4 pts) — convenience, not too close (noise)
  if (airport) {
    const mi = kmToMiles(airport.dist);
    if (mi >= 5 && mi <= 20) { factors.airport = 4; buyScore += 4; }
    else if (mi >= 3 && mi <= 30) { factors.airport = 2; buyScore += 2; }
  }

  // Restaurants / walkability proxy (max 8 pts)
  if (restaurantsWithin1mi >= 10) { factors.dining = 8; buyScore += 8; }
  else if (restaurantsWithin1mi >= 5) { factors.dining = 6; buyScore += 6; }
  else if (restaurantsWithin1mi >= 2) { factors.dining = 3; buyScore += 3; }

  // Sports / recreation (max 4 pts)
  if (sports) {
    const mi = kmToMiles(sports.dist);
    if (mi <= 3) { factors.sports = 4; buyScore += 4; }
    else if (mi <= 5) { factors.sports = 2; buyScore += 2; }
  }

  // Library (max 3 pts) — community/education access
  if (library) {
    const mi = kmToMiles(library.dist);
    if (mi <= 2) { factors.library = 3; buyScore += 3; }
    else if (mi <= 5) { factors.library = 1; buyScore += 1; }
  }

  // Tax burden (max 7 pts) — lower taxes = more attractive to buyers
  if (tax.effectiveTaxRate != null) {
    if (tax.effectiveTaxRate <= 1.0) { factors.taxBurden = 7; buyScore += 7; }
    else if (tax.effectiveTaxRate <= 1.3) { factors.taxBurden = 5; buyScore += 5; }
    else if (tax.effectiveTaxRate <= 1.6) { factors.taxBurden = 3; buyScore += 3; }
    else if (tax.effectiveTaxRate <= 2.0) { factors.taxBurden = 1; buyScore += 1; }
    // >2% effective rate = 0 pts (high tax burden)
  }

  buyScore = Math.min(buyScore, 100);

  return {
    nearestSchoolDist: school?.dist ?? null,
    nearestSchoolName: school?.name ?? null,
    schoolsWithin3mi,
    nearestHospitalDist: hospital?.dist ?? null,
    nearestHospitalName: hospital?.name ?? null,
    nearestFireStationDist: fireStation?.dist ?? null,
    nearestPoliceDist: police?.dist ?? null,
    nearestParkDist: park?.dist ?? null,
    nearestParkName: park?.name ?? null,
    parksWithin2mi,
    nearestGroceryDist: grocery?.dist ?? null,
    nearestGroceryName: grocery?.name ?? null,
    nearestMallDist: mall?.dist ?? null,
    nearestAirportDist: airport?.dist ?? null,
    nearestAirportName: airport?.name ?? null,
    nearestSportsDist: sports?.dist ?? null,
    restaurantsWithin1mi,
    nearestCourthouseDist: courthouse?.dist ?? null,
    nearestCourthouseName: courthouse?.name ?? null,
    nearestLibraryDist: library?.dist ?? null,
    nearestLibraryName: library?.name ?? null,
    librariesWithin3mi,
    countyName: tax.countyName,
    countyFips: tax.countyFips,
    countyState: tax.countyState,
    assessmentRatio: tax.assessmentRatio,
    levyPer100: tax.levyPer100,
    assessedValue: tax.assessedValue,
    estimatedAnnualTax: tax.estimatedAnnualTax,
    estimatedMonthlyTax: tax.estimatedMonthlyTax,
    effectiveTaxRate: tax.effectiveTaxRate,
    taxBurdenRating: tax.taxBurdenRating,
    buyScore,
    buyScoreFactors: factors,
  };
}
