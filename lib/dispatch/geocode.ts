/**
 * Google Maps Distance Matrix + Geocoding wrapper for dispatch.
 * Uses GOOGLE_MAPS_API_KEY (already in env).
 */

export interface DistanceResult {
  distanceMi: number;
  durationMin: number;
  originAddress: string;
  destinationAddress: string;
}

export async function getDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<DistanceResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_MAPS_API_KEY");

  const origin = `${originLat},${originLng}`;
  const dest = `${destLat},${destLng}`;
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${dest}&units=imperial&key=${apiKey}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;

  const data = await res.json();
  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") return null;

  return {
    distanceMi: Math.round((element.distance.value / 1609.34) * 100) / 100,
    durationMin: Math.round(element.duration.value / 60),
    originAddress: data.origin_addresses?.[0] || "",
    destinationAddress: data.destination_addresses?.[0] || "",
  };
}

/**
 * Batch distance from multiple origins to one destination.
 * Google allows up to 25 origins per request.
 */
export async function getBatchDistances(
  origins: { id: string; lat: number; lng: number }[],
  destLat: number,
  destLng: number
): Promise<Map<string, { distanceMi: number; durationMin: number }>> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_MAPS_API_KEY");

  const results = new Map<
    string,
    { distanceMi: number; durationMin: number }
  >();

  // Process in batches of 25
  for (let i = 0; i < origins.length; i += 25) {
    const batch = origins.slice(i, i + 25);
    const originsStr = batch.map((o) => `${o.lat},${o.lng}`).join("|");
    const dest = `${destLat},${destLng}`;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsStr}&destinations=${dest}&units=imperial&key=${apiKey}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) continue;

    const data = await res.json();
    const rows = data.rows || [];

    for (let j = 0; j < batch.length; j++) {
      const element = rows[j]?.elements?.[0];
      if (element?.status === "OK") {
        results.set(batch[j].id, {
          distanceMi:
            Math.round((element.distance.value / 1609.34) * 100) / 100,
          durationMin: Math.round(element.duration.value / 60),
        });
      }
    }
  }

  return results;
}

/**
 * Forward geocode address string to lat/lng using Google Maps Geocoding API.
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_MAPS_API_KEY");

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;

  const data = await res.json();
  const result = data.results?.[0];
  if (!result) return null;

  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}
