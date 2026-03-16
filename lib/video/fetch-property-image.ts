/**
 * Fetch a real property image via Google Street View for use in image-to-video generation.
 */

import { forwardGeocode } from "@/lib/snap/geocode";

export interface PropertyImage {
  imageUrl: string; // Google Street View static image URL
  lat: number;
  lng: number;
  source: "streetview";
}

export interface PropertyImageError {
  error: "no_geocode" | "no_coverage" | "no_api_key";
  message: string;
}

export type PropertyImageResult = PropertyImage | PropertyImageError;

function isError(r: PropertyImageResult): r is PropertyImageError {
  return "error" in r;
}

export { isError as isPropertyImageError };

export async function fetchPropertyImage(
  address: string,
  city?: string,
  state?: string,
): Promise<PropertyImageResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { error: "no_api_key", message: "Google Maps API key not configured." };
  }

  // Geocode the address
  const geo = await forwardGeocode(
    address,
    city || "",
    state || "",
  );

  if (!geo) {
    return {
      error: "no_geocode",
      message: `Could not find "${[address, city, state].filter(Boolean).join(", ")}" on the map. Check the address and try again.`,
    };
  }

  // Check Street View coverage
  const metaRes = await fetch(
    `https://maps.googleapis.com/maps/api/streetview/metadata?location=${geo.lat},${geo.lng}&key=${apiKey}`,
    { signal: AbortSignal.timeout(5000) },
  );
  const meta = await metaRes.json();

  if (meta.status !== "OK") {
    return {
      error: "no_coverage",
      message: `Google Street View has no coverage for this address. Upload your own photos to generate a video based on the real property.`,
    };
  }

  // Build high-res Street View image URL (800x600 for good I2V source)
  const imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${geo.lat},${geo.lng}&key=${apiKey}&fov=110`;

  return {
    imageUrl,
    lat: geo.lat,
    lng: geo.lng,
    source: "streetview",
  };
}
