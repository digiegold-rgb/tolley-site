/**
 * Washer & dryer delivery ZIP allowlist.
 *
 * The owner may trim or extend this list. It is the single source of truth
 * for whether we can deliver a washer/dryer rental (about 25 minutes of
 * Independence, MO 64052).
 */
export const WD_SERVICE_ZIPS = [
  // Independence
  "64050",
  "64052",
  "64053",
  "64054",
  "64055",
  "64056",
  "64057",
  "64058",
  // Blue Springs
  "64013",
  "64014",
  "64015",
  // Grain Valley
  "64029",
  // Buckner
  "64016",
  // Raytown
  "64133",
  "64138",
  // Lee's Summit
  "64063",
  "64064",
  "64081",
  "64082",
  "64086",
  // East KC
  "64120",
  "64123",
  "64124",
  "64125",
  "64126",
  "64127",
  "64128",
  "64129",
  // Gladstone / North KC
  "64118",
  "64119",
] as const;

/** City labels shown on /wd. Keep them aligned with the ZIP comments above. */
export const WD_SERVICE_CITY_LABELS = [
  "Independence",
  "Blue Springs",
  "Grain Valley",
  "Buckner",
  "Raytown",
  "Lee's Summit",
  "East Kansas City",
  "Gladstone",
  "North Kansas City",
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
