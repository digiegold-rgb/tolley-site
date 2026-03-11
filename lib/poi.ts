/**
 * Point of Interest fetcher using OpenStreetMap Overpass API.
 * Free, no API key needed, covers all POI types.
 */

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export interface RawPOI {
  osmId: string;
  type: string;
  name: string | null;
  lat: number;
  lng: number;
  tags: Record<string, string>;
}

// KC metro bounding box (covers Heartland MLS territory)
// SW corner to NE corner: covers KC metro + surrounding counties
const KC_BBOX = "37.0,-97.8,40.2,-93.5";

const POI_QUERIES: Record<string, string> = {
  school: '["amenity"="school"]',
  hospital: '["amenity"="hospital"]',
  fire_station: '["amenity"="fire_station"]',
  police: '["amenity"="police"]',
  park: '["leisure"="park"]',
  grocery: '["shop"="supermarket"]',
  mall: '["shop"="mall"]',
  airport: '["aeroway"="aerodrome"]["iata"]', // only airports with IATA codes
  sports: '["leisure"="sports_centre"]',
  restaurant: '["amenity"="restaurant"]',
  courthouse: '["amenity"="courthouse"]',
  library: '["amenity"="library"]',
};

/**
 * Fetch POIs of a given type from Overpass API.
 */
export async function fetchPOIs(type: string): Promise<RawPOI[]> {
  const filter = POI_QUERIES[type];
  if (!filter) throw new Error(`Unknown POI type: ${type}`);

  // Use node+way for most types, node only for restaurants (too many ways)
  const elements = type === "restaurant" ? "node" : "nwr";

  const query = `
    [out:json][timeout:120];
    (
      ${elements}${filter}(${KC_BBOX});
    );
    out center tags;
  `;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(130_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Overpass API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const results: RawPOI[] = [];

  for (const el of data.elements || []) {
    // Nodes have lat/lon directly; ways/relations have center
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;

    if (!lat || !lng) continue;

    results.push({
      osmId: `${el.type}/${el.id}`,
      type,
      name: el.tags?.name || null,
      lat,
      lng,
      tags: el.tags || {},
    });
  }

  return results;
}

/**
 * Fetch all POI types. Returns flat array.
 */
export async function fetchAllPOIs(): Promise<RawPOI[]> {
  const types = Object.keys(POI_QUERIES);
  const all: RawPOI[] = [];

  // Fetch sequentially to be nice to Overpass API
  for (const type of types) {
    console.log(`[poi] Fetching ${type}...`);
    try {
      const pois = await fetchPOIs(type);
      console.log(`[poi] ${type}: ${pois.length} found`);
      all.push(...pois);
    } catch (err) {
      console.error(`[poi] ${type} failed:`, err);
      // Continue with other types
    }
  }

  return all;
}

/**
 * Haversine distance in kilometers between two lat/lng points.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Convert km to miles.
 */
export function kmToMiles(km: number): number {
  return km * 0.621371;
}
