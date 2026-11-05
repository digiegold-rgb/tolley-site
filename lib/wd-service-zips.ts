/**
 * Washer & dryer delivery ZIPs by driving time.
 *
 * Origin: interior point (INTPTLAT/INTPTLONG) of ZCTA 64052, Independence, MO
 * (39.073616, -94.450866) from the US Census 2024 Gazetteer national ZCTA file
 * (2024_Gaz_zcta_national.zip). Place names are the 2020 Census ZCTA-to-place
 * relationship (largest land overlap), with county subdivision as a fallback.
 * Drive times are from the public OSRM demo table service
 * (https://router.project-osrm.org/table/v1/driving, sources=0), generated 2026-09-26.
 * Candidates were every ZCTA whose centroid is within 40 straight-line miles.
 *
 * This list is static and hand-editable. The owner may trim or extend it.
 * It is the single source of truth for washer/dryer delivery. Rebuild later with
 * `node scripts/gen-wd-service-zips.mjs`. That script does not run at build time
 * or at runtime.
 *
 * WD_SERVICE_ZIPS is every routed ZIP at 25.0 driving minutes or less.
 * WD_BORDERLINE_ZIPS is just over 25.0 minutes through 30.0 minutes.
 * Borderline ZIPs are exported so the owner can move them up. isWdServiceZip does not allow them.
 * 64013 (Blue Springs, MO) is not a 2024 Census ZCTA. A Census geocode is about 23.2 driving minutes. It is not in either list; add it by hand if it should be served.
 */
export const WD_SERVICE_ZIPS = [
  // Independence, MO, 0.0 min
  "64052",
  // Sugar Creek, MO, 8.3 min
  "64054",
  // Kansas City, MO, 8.4 min
  "64126",
  // Independence, MO, 9.2 min
  "64053",
  // Independence, MO, 10.2 min
  "64055",
  // Kansas City, MO, 10.2 min
  "64129",
  // Kansas City, MO, 11.4 min
  "64127",
  // Kansas City, MO, 11.7 min
  "64125",
  // Kansas City, MO, 12.1 min
  "64133",
  // Kansas City, MO, 12.2 min
  "64128",
  // Independence, MO, 12.7 min
  "64050",
  // Kansas City, MO, 13.2 min
  "64136",
  // Kansas City, MO, 13.5 min
  "64120",
  // Kansas City, MO, 13.5 min
  "64123",
  // Kansas City, MO, 14.1 min
  "64124",
  // Kansas City, MO, 15.5 min
  "64106",
  // Kansas City, MO, 15.6 min
  "64130",
  // Kansas City, MO, 16.1 min
  "64109",
  // Kansas City, MO, 16.3 min
  "64117",
  // Blue Springs, MO, 17.3 min
  "64015",
  // Kansas City, MO, 17.8 min
  "64108",
  // Lee's Summit, MO, 18.1 min
  "64064",
  // Kansas City, MO, 18.4 min
  "64105",
  // Kansas City, MO, 18.5 min
  "64138",
  // Kansas City, MO, 18.9 min
  "64102",
  // Kansas City, MO, 18.9 min
  "64110",
  // Kansas City, MO, 19.0 min
  "64101",
  // Kansas City, MO, 19.2 min
  "64161",
  // Kansas City, MO, 19.6 min
  "64111",
  // Kansas City, MO, 19.8 min
  "64139",
  // Kansas City, MO, 20.7 min
  "64158",
  // Kansas City, KS, 21.0 min
  "66118",
  // Blue Springs, MO, 21.1 min
  "64014",
  // Kansas City, KS, 21.1 min
  "66101",
  // Kansas City, MO, 21.5 min
  "64116",
  // Independence, MO, 21.6 min
  "64057",
  // Kansas City, MO, 21.7 min
  "64112",
  // Kansas City, MO, 22.2 min
  "64119",
  // Independence, MO, 23.3 min
  "64056",
  // Kansas City, MO, 23.3 min
  "64113",
  // Kansas City, KS, 23.4 min
  "66160",
  // Unity Village, MO, 23.6 min
  "64065",
  // Kansas City, MO, 23.7 min
  "64132",
  // Kansas City, MO, 23.7 min
  "64137",
  // Kansas City, MO, 24.0 min
  "64156",
  // Lee's Summit, MO, 24.7 min
  "64063",
  // Kansas City, MO, 24.7 min
  "64134",
  // Kansas City, KS, 24.8 min
  "66105",
] as const;

/**
 * Borderline: just over 25.0 driving minutes and at most 30.0.
 * Not a delivery area. Move an entry into WD_SERVICE_ZIPS to start serving it.
 */
export const WD_BORDERLINE_ZIPS = [
  // Lee's Summit, MO, 25.2 min
  "64081",
  // Grain Valley, MO, 25.3 min
  "64029",
  // Grandview, MO, 25.3 min
  "64030",
  // Kansas City, KS, 25.7 min
  "66103",
  // Kansas City, MO, 25.8 min
  "64157",
  // Kansas City, MO, 26.4 min
  "64131",
  // Kansas City, MO, 26.7 min
  "64114",
  // Roeland Park, KS, 26.9 min
  "66205",
  // Leawood, KS, 27.3 min
  "66206",
  // Leawood, KS, 27.4 min
  "66211",
  // Kansas City, KS, 27.5 min
  "66115",
  // Kansas City, MO, 27.6 min
  "64166",
  // Mission, KS, 27.6 min
  "66202",
  // Riverside, MO, 27.7 min
  "64150",
  // Kansas City, MO, 28.1 min
  "64118",
  // Missouri City, MO, 28.7 min
  "64072",
  // Kansas City, MO, 29.1 min
  "64155",
  // Kansas City, KS, 29.1 min
  "66102",
  // Prairie Village, KS, 29.1 min
  "66208",
  // Shawnee, KS, 29.3 min
  "66203",
  // Kansas City, MO, 29.7 min
  "64165",
] as const;

/** City labels shown on /wd, in order of the closest included ZIP for that place. */
export const WD_SERVICE_CITY_LABELS = [
  "Independence, MO",
  "Sugar Creek, MO",
  "Kansas City, MO",
  "Blue Springs, MO",
  "Lee's Summit, MO",
  "Kansas City, KS",
  "Unity Village, MO",
] as const;

export const WD_OUT_OF_AREA_MESSAGE =
  "Thank you so much for your interest! Right now we only service within about 25 minutes of Independence, so we can't deliver to your area. Leave your number and we'll reach out if that changes.";

const WD_SERVICE_ZIP_SET = new Set<string>(WD_SERVICE_ZIPS);

/** Trim, keep digits, and use the first 5. Returns null when fewer than 5 digits. */
export function normalizeWdZip(input: string): string | null {
  const digits = input.trim().replace(/\D/g, "");
  if (digits.length < 5) return null;
  return digits.slice(0, 5);
}

export function isWdServiceZip(zip: string): boolean {
  const normalized = normalizeWdZip(zip);
  return normalized != null && WD_SERVICE_ZIP_SET.has(normalized);
}

export type WdCheckoutZipDecision =
  | { ok: true; zip: string }
  | { ok: false; status: 400 | 422; error: string; outOfArea?: boolean };

/** Server-side gate for creating a W/D Checkout Session. Call this before Stripe. */
export function wdCheckoutZipDecision(zip: unknown): WdCheckoutZipDecision {
  const normalized = typeof zip === "string" ? normalizeWdZip(zip) : null;
  if (!normalized) {
    return { ok: false, status: 400, error: "A five-digit delivery ZIP is required." };
  }
  if (!isWdServiceZip(normalized)) {
    return { ok: false, status: 422, error: WD_OUT_OF_AREA_MESSAGE, outOfArea: true };
  }
  return { ok: true, zip: normalized };
}

export type WdQuoteFieldsResult =
  | { ok: true; zip: string; outOfArea: boolean; fields: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Normalize a request_wd_quote payload. Out-of-area ZIPs are still saved;
 * `outOfArea` is set here and must not be taken from the client.
 */
export function prepareWdQuoteFields(fields: Record<string, unknown>): WdQuoteFieldsResult {
  const normalized = typeof fields.zip === "string" ? normalizeWdZip(fields.zip) : null;
  if (!normalized) return { ok: false, error: "A five-digit delivery ZIP is required." };
  const outOfArea = !isWdServiceZip(normalized);
  const rest = { ...fields };
  delete rest.zip;
  delete rest.outOfArea;
  return { ok: true, zip: normalized, outOfArea, fields: { zip: normalized, outOfArea, ...rest } };
}
