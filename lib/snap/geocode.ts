/**
 * Reverse geocoding — GPS coordinates to street address.
 * Uses OpenStreetMap Nominatim (free, no API key).
 */

export interface GeocodedAddress {
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string | null;
  confidence: "rooftop" | "street" | "area";
}

/**
 * Reverse geocode GPS coordinates to a street address.
 * Uses Nominatim with a 1 req/sec rate limit.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodedAddress | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1&zoom=18`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "T-Agent/1.0 (tolley.io; snap feature)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.address) return null;

    const addr = data.address;
    const houseNumber = addr.house_number || "";
    const road = addr.road || "";
    const streetAddress = [houseNumber, road].filter(Boolean).join(" ").trim();

    if (!streetAddress) return null;

    const city =
      addr.city || addr.town || addr.village || addr.hamlet || "";
    const state = addr.state || "";
    const zip = addr.postcode || "";
    const county = addr.county
      ? addr.county.replace(/ County$/i, "")
      : null;

    // Confidence based on Nominatim place_rank
    // 26+ = building-level, 22-25 = street-level, <22 = area
    const rank = data.place_rank || 0;
    const confidence: GeocodedAddress["confidence"] =
      rank >= 26 ? "rooftop" : rank >= 22 ? "street" : "area";

    return {
      address: streetAddress,
      city,
      state,
      zip,
      county,
      confidence,
    };
  } catch {
    return null;
  }
}

/**
 * Forward geocode an address string to GPS coordinates.
 * Used when user enters address manually.
 */
export async function forwardGeocode(
  address: string,
  city: string,
  state: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = `${address}, ${city}, ${state}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "T-Agent/1.0 (tolley.io; snap feature)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const results = await res.json();
    if (!results.length) return null;

    const { lat, lon } = results[0];
    return { lat: parseFloat(lat), lng: parseFloat(lon) };
  } catch {
    return null;
  }
}
