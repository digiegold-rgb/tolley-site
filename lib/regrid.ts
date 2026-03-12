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
  properties: {
    headline: string;
    path: string;
    fields: RegridFields;
    context?: Record<string, unknown>;
    addresses?: unknown[];
    enhanced_ownership?: unknown;
    ll_uuid: string;
  };
  geometry: {
    type: string;
    coordinates: unknown;
  } | null;
}

/** Parcel data fields — nested under properties.fields in the API response */
export interface RegridFields {
  ll_uuid?: string;
  parcelnumb: string | null;
  parcelnumb_no_formatting?: string | null;
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
  owner2?: string | null;
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
  usps_vacancy_date?: string | null;
  qoz: string | null;
  // LBCS codes
  lbcs_activity?: number | null;
  lbcs_activity_desc?: string | null;
  // Extra
  geoid?: string | null;
  fema_nri_risk_rating?: string | null;
  [key: string]: unknown;
}

/** Legacy alias — use RegridFields for new code */
export type RegridProperties = RegridFields;

/** Raw API response — features nested under `parcels`, with optional buildings/zoning */
export interface RegridApiResponse {
  parcels: {
    type: "FeatureCollection";
    features: RegridFeature[];
  };
  buildings?: {
    type: "FeatureCollection";
    features: unknown[];
  };
  zoning?: {
    type: "FeatureCollection";
    features: unknown[];
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
  // Data fields are nested under properties.fields in the API response
  const f = feature.properties.fields;

  // Build address from components if full address is null
  const address =
    f.address ||
    [f.saddno, f.saddpref, f.saddstr, f.saddsttyp, f.saddstsuf]
      .filter(Boolean)
      .join(" ") ||
    "Unknown";

  const isAbsentee = detectAbsentee(
    address,
    f.scity,
    [f.mailadd, f.mail_city, f.mail_state2, f.mail_zip].filter(Boolean).join(", ")
  );

  const isVacant = f.usps_vacancy === "Y";

  return {
    // ll_uuid is on both properties and properties.fields
    regridId: feature.properties.ll_uuid || f.ll_uuid || String(feature.id),
    parcelnumb: f.parcelnumb,
    address,
    city: f.scity,
    state: f.state2,
    zip: f.szip,
    county: f.county,
    lat: f.lat,
    lng: f.lon,
    owner: f.owner,
    owntype: f.owntype,
    ownfrst: f.ownfrst,
    ownlast: f.ownlast,
    mailadd: f.mailadd,
    mailcity: f.mail_city,
    mailstate: f.mail_state2,
    mailzip: f.mail_zip,
    isAbsentee,
    isVacant,
    parval: f.parval,
    landval: f.landval,
    improvval: f.improvval,
    saleprice: f.saleprice,
    saledate: f.saledate,
    taxamt: f.taxamt,
    yearbuilt: f.yearbuilt,
    numstories: f.numstories,
    numunits: f.numunits,
    num_bedrooms: f.num_bedrooms,
    num_bath: f.num_bath,
    struct: f.struct,
    ll_gisacre: f.ll_gisacre,
    ll_gissqft: f.ll_gissqft,
    zoning: f.zoning,
    zoning_description: f.zoning_description,
    usps_vacancy: f.usps_vacancy,
    qoz: f.qoz === "Yes" || f.qoz === "Y" || f.qoz === "true",
    rawData: f,
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
