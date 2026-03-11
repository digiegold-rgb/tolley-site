/**
 * Regrid Parcel API Client — TypeScript
 *
 * Covers parcel lookups by address, point, owner name, and bulk query.
 * Auth: ?token=XXX query parameter.
 * Rate limiting: max 5 concurrent, 300ms between batches.
 */

const REGRID_BASE = "https://app.regrid.com/api/v2";

function getToken(): string {
  const token = process.env.REGRID_API_TOKEN;
  if (!token) throw new Error("Missing REGRID_API_TOKEN env var");
  return token;
}

function buildUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(`${REGRID_BASE}${path}`);
  url.searchParams.set("token", getToken());
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

// ── Types ────────────────────────────────────────────────────

export interface RegridFeature {
  type: "Feature";
  id: number;
  properties: RegridProperties;
  geometry: {
    type: string;
    coordinates: unknown;
  } | null;
}

export interface RegridProperties {
  ll_uuid: string;
  parcelnumb: string | null;
  // Address
  address: string | null;
  saddno: string | null;
  saddpref: string | null;
  saddstr: string | null;
  saddsttyp: string | null;
  saddstsuf: string | null;
  sunit: string | null;
  scity: string | null;
  state2: string | null;
  szip: string | null;
  county: string | null;
  lat: number | null;
  lon: number | null;
  // Owner
  owner: string | null;
  owntype: string | null;
  ownfrst: string | null;
  ownlast: string | null;
  mailadd: string | null;
  mail_city: string | null;
  mail_state2: string | null;
  mail_zip: string | null;
  // Values
  parval: number | null;
  landval: number | null;
  improvval: number | null;
  saleprice: number | null;
  saledate: string | null;
  taxamt: number | null;
  // Structure
  yearbuilt: number | null;
  numstories: number | null;
  numunits: number | null;
  num_bedrooms: number | null;
  num_bath: number | null;
  struct: string | null;
  ll_gisacre: number | null;
  ll_gissqft: number | null;
  // Zoning
  zoning: string | null;
  zoning_description: string | null;
  usps_vacancy: string | null;
  qoz: string | null;
  [key: string]: unknown;
}

/** Raw API response — features are nested under `parcels` */
export interface RegridApiResponse {
  parcels: {
    type: "FeatureCollection";
    features: RegridFeature[];
  };
}

/** Extracted feature collection (after unwrapping) */
export interface RegridResponse {
  type: "FeatureCollection";
  features: RegridFeature[];
}

/** Unwrap the Regrid response envelope */
function unwrapResponse(raw: RegridApiResponse): RegridFeature[] {
  return raw?.parcels?.features ?? [];
}

/** Get the last feature ID for offset_id pagination */
function lastFeatureId(features: RegridFeature[]): number | null {
  if (!features.length) return null;
  return features[features.length - 1].id;
}

export interface ParsedParcel {
  regridId: string;
  parcelnumb: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  lat: number | null;
  lng: number | null;
  owner: string | null;
  owntype: string | null;
  ownfrst: string | null;
  ownlast: string | null;
  mailadd: string | null;
  mailcity: string | null;
  mailstate: string | null;
  mailzip: string | null;
  isAbsentee: boolean;
  isVacant: boolean;
  parval: number | null;
  landval: number | null;
  improvval: number | null;
  saleprice: number | null;
  saledate: string | null;
  taxamt: number | null;
  yearbuilt: number | null;
  numstories: number | null;
  numunits: number | null;
  num_bedrooms: number | null;
  num_bath: number | null;
  struct: string | null;
  ll_gisacre: number | null;
  ll_gissqft: number | null;
  zoning: string | null;
  zoning_description: string | null;
  usps_vacancy: string | null;
  qoz: boolean;
  rawData: RegridProperties;
  geometry: unknown | null;
}

// ── Rate limiter ──────────────────────────────────────────────

let activeRequests = 0;
const MAX_CONCURRENT = 5;
const BATCH_DELAY = 300;

async function throttledFetch(url: string): Promise<Response> {
  while (activeRequests >= MAX_CONCURRENT) {
    await new Promise((r) => setTimeout(r, 50));
  }
  activeRequests++;
  try {
    const res = await fetch(url, {
      headers: {
        "Accept-Encoding": "gzip",
        "User-Agent": "TolleyIO-Regrid/1.0",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Regrid API ${res.status}: ${body.slice(0, 300)}`);
    }
    return res;
  } finally {
    activeRequests--;
    await new Promise((r) => setTimeout(r, BATCH_DELAY));
  }
}

// ── Feature parser ───────────────────────────────────────────

export function parseFeature(feature: RegridFeature): ParsedParcel {
  const p = feature.properties;

  // Build address from components if full address is null
  const address =
    p.address ||
    [p.saddno, p.saddpref, p.saddstr, p.saddsttyp, p.saddstsuf]
      .filter(Boolean)
      .join(" ") ||
    "Unknown";

  const isAbsentee = detectAbsentee(
    address,
    p.scity,
    [p.mailadd, p.mail_city, p.mail_state2, p.mail_zip].filter(Boolean).join(", ")
  );

  const isVacant = p.usps_vacancy === "Y";

  return {
    regridId: p.ll_uuid || String(feature.id),
    parcelnumb: p.parcelnumb,
    address,
    city: p.scity,
    state: p.state2,
    zip: p.szip,
    county: p.county,
    lat: p.lat,
    lng: p.lon,
    owner: p.owner,
    owntype: p.owntype,
    ownfrst: p.ownfrst,
    ownlast: p.ownlast,
    mailadd: p.mailadd,
    mailcity: p.mail_city,
    mailstate: p.mail_state2,
    mailzip: p.mail_zip,
    isAbsentee,
    isVacant,
    parval: p.parval,
    landval: p.landval,
    improvval: p.improvval,
    saleprice: p.saleprice,
    saledate: p.saledate,
    taxamt: p.taxamt,
    yearbuilt: p.yearbuilt,
    numstories: p.numstories,
    numunits: p.numunits,
    num_bedrooms: p.num_bedrooms,
    num_bath: p.num_bath,
    struct: p.struct,
    ll_gisacre: p.ll_gisacre,
    ll_gissqft: p.ll_gissqft,
    zoning: p.zoning,
    zoning_description: p.zoning_description,
    usps_vacancy: p.usps_vacancy,
    qoz: p.qoz === "Yes" || p.qoz === "Y" || p.qoz === "true",
    rawData: p,
    geometry: feature.geometry,
  };
}

// ── Absentee detection ──────────────────────────────────────

export function detectAbsentee(
  situsAddress: string | null,
  situsCity: string | null,
  mailingFull: string | null
): boolean {
  if (!situsAddress || !mailingFull) return false;

  // Normalize both addresses
  const normSitus = normalizeAddr(situsAddress);
  const normMailing = normalizeAddr(mailingFull);

  // If mailing is empty after normalization, can't determine
  if (!normMailing || !normSitus) return false;

  // Extract street number from situs
  const situsNum = normSitus.match(/^\d+/)?.[0];
  const mailingNum = normMailing.match(/^\d+/)?.[0];

  // If street numbers differ, it's absentee
  if (situsNum && mailingNum && situsNum !== mailingNum) return true;

  // If city is provided and differs from mailing city
  if (situsCity) {
    const normCity = situsCity.toLowerCase().trim();
    if (normMailing && !normMailing.includes(normCity)) return true;
  }

  return false;
}

function normalizeAddr(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\b(st|street|ave|avenue|blvd|boulevard|dr|drive|rd|road|ln|lane|ct|court|pl|place|way|cir|circle)\b/g, (m) => {
      const map: Record<string, string> = {
        st: "st", street: "st", ave: "ave", avenue: "ave",
        blvd: "blvd", boulevard: "blvd", dr: "dr", drive: "dr",
        rd: "rd", road: "rd", ln: "ln", lane: "ln",
        ct: "ct", court: "ct", pl: "pl", place: "pl",
        way: "way", cir: "cir", circle: "cir",
      };
      return map[m] || m;
    })
    .trim();
}

// ── Core API functions ───────────────────────────────────────

/**
 * Lookup parcel(s) by street address.
 */
export async function lookupByAddress(query: string): Promise<ParsedParcel[]> {
  const url = buildUrl("/parcels/address", { query });
  const res = await throttledFetch(url);
  const raw: RegridApiResponse = await res.json();
  return unwrapResponse(raw).map(parseFeature);
}

/**
 * Lookup parcels near a lat/lng point.
 */
export async function lookupByPoint(
  lat: number,
  lng: number,
  radius?: number
): Promise<ParsedParcel[]> {
  const params: Record<string, string> = {
    lat: String(lat),
    lon: String(lng),
  };
  if (radius) params.radius = String(radius);
  const url = buildUrl("/parcels/point", params);
  const res = await throttledFetch(url);
  const raw: RegridApiResponse = await res.json();
  return unwrapResponse(raw).map(parseFeature);
}

/**
 * Search parcels by owner name.
 * Uses /parcels/owner endpoint with `owner` param and optional `path` for location scoping.
 * Path format: "us/{state}" or "us/{state}/{county}"
 */
export async function searchByOwner(
  name: string,
  options?: { state?: string; county?: string }
): Promise<ParsedParcel[]> {
  const params: Record<string, string> = { owner: name };
  // Build location path for scoping: us/mo or us/mo/jackson
  if (options?.state) {
    let path = `us/${options.state.toLowerCase()}`;
    if (options.county) path += `/${options.county.toLowerCase()}`;
    params.path = path;
  }
  const url = buildUrl("/parcels/owner", params);
  const res = await throttledFetch(url);
  const raw: RegridApiResponse = await res.json();
  return unwrapResponse(raw).map(parseFeature);
}

/**
 * Query parcels with field-based filters.
 * Regrid uses `fields[field_name][operator]=value` format.
 * Accepts simple { field: value } and converts to fields[field][eq]=value.
 */
export async function queryParcels(
  filters: Record<string, string>
): Promise<ParsedParcel[]> {
  // Convert simple filters to Regrid fields format
  const params: Record<string, string> = {};
  for (const [field, value] of Object.entries(filters)) {
    if (field.startsWith("fields[") || field === "return_geometry" || field === "offset_id") {
      params[field] = value; // Already formatted or control param
    } else {
      params[`fields[${field}][eq]`] = value;
    }
  }
  const url = buildUrl("/parcels/query", params);
  const res = await throttledFetch(url);
  const raw: RegridApiResponse = await res.json();
  return unwrapResponse(raw).map(parseFeature);
}

/**
 * Bulk scan a zip code for parcels, with optional filters.
 * Paginates through all results using offset_id (last feature ID).
 */
export async function scanZipCode(
  zip: string,
  opts?: {
    absenteeOnly?: boolean;
    vacantOnly?: boolean;
    minValue?: number;
    maxValue?: number;
    returnGeometry?: boolean;
    maxRecords?: number;
  }
): Promise<ParsedParcel[]> {
  const maxRecords = opts?.maxRecords ?? 10_000;
  const results: ParsedParcel[] = [];

  const baseParams: Record<string, string> = {
    [`fields[szip][eq]`]: zip,
  };
  if (opts?.returnGeometry === false) {
    baseParams.return_geometry = "false";
  }

  let offsetId: number | null = null;
  let hasMore = true;

  while (hasMore && results.length < maxRecords) {
    const params = { ...baseParams };
    if (offsetId !== null) {
      params.offset_id = String(offsetId);
    }

    const url = buildUrl("/parcels/query", params);
    const res = await throttledFetch(url);
    const raw: RegridApiResponse = await res.json();
    const features = unwrapResponse(raw);

    if (features.length === 0) {
      hasMore = false;
      break;
    }

    for (const feature of features) {
      if (results.length >= maxRecords) break;
      const parsed = parseFeature(feature);

      // Client-side filtering
      if (opts?.absenteeOnly && !parsed.isAbsentee) continue;
      if (opts?.vacantOnly && !parsed.isVacant) continue;
      if (opts?.minValue && (parsed.parval ?? 0) < opts.minValue) continue;
      if (opts?.maxValue && (parsed.parval ?? Infinity) > opts.maxValue) continue;

      results.push(parsed);
    }

    // Pagination: use last feature ID as offset_id for next page
    offsetId = lastFeatureId(features);
    if (!offsetId) hasMore = false;
  }

  return results;
}
