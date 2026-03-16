import { prisma } from "@/lib/prisma";
import { getBatchDistances } from "./geocode";
import { DISPATCH_MATCHING, DRIVER_STATUS } from "./constants";

interface MatchCandidate {
  driverId: string;
  name: string;
  phone: string;
  distanceMi: number;
  etaMin: number;
  score: number;
}

export interface MatchResult {
  candidates: MatchCandidate[];
  log: string;
}

/**
 * Find and rank best drivers for an order.
 * Core matching is deterministic — no LLM needed for standard cases.
 */
export async function findMatchingDrivers(
  pickupLat: number,
  pickupLng: number,
  vehicleRequirement: string | null,
  weightLbs: number | null,
  radiusMi: number = DISPATCH_MATCHING.defaultRadiusMi,
  excludeDriverIds: string[] = []
): Promise<MatchResult> {
  const log: string[] = [];

  // 1. Find online, approved drivers
  const drivers = await prisma.deliveryDriver.findMany({
    where: {
      status: DRIVER_STATUS.APPROVED,
      isOnline: true,
      currentLat: { not: null },
      currentLng: { not: null },
      ...(excludeDriverIds.length > 0
        ? { id: { notIn: excludeDriverIds } }
        : {}),
      ...(weightLbs ? { maxWeightLbs: { gte: weightLbs } } : {}),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      vehicleType: true,
      currentLat: true,
      currentLng: true,
      avgRating: true,
      completionRate: true,
      totalDeliveries: true,
      serviceRadiusMi: true,
      lastLocationAt: true,
    },
  });

  log.push(`Found ${drivers.length} online drivers`);

  if (drivers.length === 0) {
    return { candidates: [], log: log.join("; ") };
  }

  // 2. Filter by vehicle capability if specified
  let filtered = drivers;
  if (vehicleRequirement) {
    const vehicleRank: Record<string, number> = {
      sedan: 1,
      suv: 2,
      pickup: 3,
      van: 4,
      box_truck: 5,
      flatbed: 6,
      trailer: 7,
    };
    const requiredRank = vehicleRank[vehicleRequirement] || 0;
    filtered = drivers.filter(
      (d) => (vehicleRank[d.vehicleType] || 0) >= requiredRank
    );
    log.push(
      `${filtered.length} with vehicle >= ${vehicleRequirement}`
    );
  }

  if (filtered.length === 0) {
    return { candidates: [], log: log.join("; ") };
  }

  // 3. Calculate distances via Google Distance Matrix
  const origins = filtered.map((d) => ({
    id: d.id,
    lat: d.currentLat!,
    lng: d.currentLng!,
  }));

  const distances = await getBatchDistances(origins, pickupLat, pickupLng);
  log.push(`Got distances for ${distances.size} drivers`);

  // 4. Filter by radius and score
  const s = DISPATCH_MATCHING.scoring;
  const candidates: MatchCandidate[] = [];

  for (const driver of filtered) {
    const dist = distances.get(driver.id);
    if (!dist) continue;
    if (dist.distanceMi > Math.min(radiusMi, driver.serviceRadiusMi)) continue;

    // Proximity score: 1.0 at 0 mi, 0.0 at radius
    const proximityScore = Math.max(0, 1 - dist.distanceMi / radiusMi);

    // Rating score: normalized to 0-1 (4.0 = 0.5, 5.0 = 1.0)
    const ratingScore = Math.max(0, (driver.avgRating - 3) / 2);

    // Completion score: already 0-1
    const completionScore = driver.completionRate;

    // Recency score: prefer drivers with recent location updates
    const lastUpdate = driver.lastLocationAt?.getTime() || 0;
    const minutesAgo = (Date.now() - lastUpdate) / 60000;
    const recencyScore = Math.max(0, 1 - minutesAgo / 30);

    const score =
      proximityScore * s.proximityWeight +
      ratingScore * s.ratingWeight +
      completionScore * s.completionWeight +
      recencyScore * s.recencyWeight;

    candidates.push({
      driverId: driver.id,
      name: driver.name,
      phone: driver.phone,
      distanceMi: dist.distanceMi,
      etaMin: dist.durationMin,
      score,
    });
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  log.push(
    `${candidates.length} candidates within radius, top: ${candidates
      .slice(0, 3)
      .map((c) => `${c.name}(${c.score.toFixed(2)})`)
      .join(", ")}`
  );

  return {
    candidates: candidates.slice(0, DISPATCH_MATCHING.maxDriversToNotify),
    log: log.join("; "),
  };
}
