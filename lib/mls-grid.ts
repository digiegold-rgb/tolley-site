/**
 * MLS Grid API v2 Client — TypeScript
 * Heartland MLS (hmls) via MLS Grid replication API.
 *
 * Key constraint: the API only supports filtering on a handful of fields
 * (OriginatingSystemName, StandardStatus, ModificationTimestamp, etc.).
 * ZIP, city, price, beds/baths must be filtered locally after fetch.
 */

export interface MLSProperty {
  ListingId: string;
  StandardStatus: string;
  ListPrice: number | null;
  OriginalListPrice: number | null;
  StreetNumber: string | null;
  StreetName: string | null;
  StreetSuffix: string | null;
  StreetDirPrefix: string | null;
  City: string | null;
  StateOrProvince: string | null;
  PostalCode: string | null;
  BedroomsTotal: number | null;
  BathroomsFull: number | null;
  BathroomsHalf: number | null;
  LivingAreaTotal: number | null;
  AboveGradeFinishedArea: number | null;
  PropertyType: string | null;
  PropertySubType: string | null;
  DaysOnMarket: number | null;
  OnMarketDate: string | null;
  ListingContractDate: string | null;
  CloseDate: string | null;
  ModificationTimestamp: string | null;
  ListAgentFullName: string | null;
  ListAgentMlsId: string | null;
  ListOfficeName: string | null;
  ListOfficeMlsId: string | null;
  PublicRemarks: string | null;
  Latitude: number | null;
  Longitude: number | null;
  LotSizeSquareFeet: number | null;
  Media?: Array<{ MediaURL?: string }>;
  [key: string]: unknown;
}

interface MLSGridResponse {
  value: MLSProperty[];
  "@odata.nextLink"?: string;
}

export interface ParsedListing {
  mlsId: string;
  status: string;
  listPrice: number | null;
  originalListPrice: number | null;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  propertyType: string | null;
  daysOnMarket: number | null;
  onMarketDate: Date | null;
  closeDate: Date | null;
  listingUrl: string;
  photoUrls: string[];
  listAgentName: string | null;
  listAgentMlsId: string | null;
  listOfficeName: string | null;
  listOfficeMlsId: string | null;
  lat: number | null;
  lng: number | null;
  rawData: MLSProperty;
}

const MLS_CODE = "hmls";
const DEFAULT_ENDPOINT = "https://api.mlsgrid.com/v2";

function getConfig() {
  const token = process.env.MLS_GRID_TOKEN;
  if (!token) throw new Error("Missing MLS_GRID_TOKEN env var");
  const endpoint = process.env.MLS_GRID_ENDPOINT || DEFAULT_ENDPOINT;
  return { token, endpoint };
}

function parseProperty(prop: MLSProperty): ParsedListing {
  const street = [
    prop.StreetNumber,
    prop.StreetName,
    prop.StreetSuffix,
  ]
    .filter(Boolean)
    .join(" ");

  const city = prop.City || null;
  const state = prop.StateOrProvince || "MO";
  const zip = prop.PostalCode || null;
  const address = [street, city, `${state} ${zip || ""}`]
    .filter(Boolean)
    .join(", ")
    .replace(/\s+/g, " ")
    .trim();

  let baths: number | null = null;
  const full = Number(prop.BathroomsFull) || 0;
  const half = Number(prop.BathroomsHalf) || 0;
  if (full || half) baths = full + half * 0.5;

  const sqft =
    Number(prop.LivingAreaTotal) ||
    Number(prop.AboveGradeFinishedArea) ||
    null;

  const photos: string[] = [];
  if (prop.Media) {
    for (const m of prop.Media) {
      if (m.MediaURL) photos.push(m.MediaURL);
    }
  }

  // Compute days on market from ListingContractDate if DaysOnMarket not provided
  let daysOnMarket: number | null =
    prop.DaysOnMarket != null ? Number(prop.DaysOnMarket) : null;

  const contractDate =
    prop.ListingContractDate || prop.OnMarketDate || null;

  if (daysOnMarket == null && contractDate) {
    const listed = new Date(contractDate);
    const now = new Date();
    daysOnMarket = Math.floor(
      (now.getTime() - listed.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysOnMarket < 0) daysOnMarket = 0;
  }

  const onMarketDate = contractDate ? new Date(contractDate) : null;

  return {
    mlsId: prop.ListingId,
    status: prop.StandardStatus || "Unknown",
    listPrice: prop.ListPrice ?? null,
    originalListPrice: prop.OriginalListPrice ?? null,
    address,
    city,
    state,
    zip,
    beds: prop.BedroomsTotal != null ? Number(prop.BedroomsTotal) : null,
    baths,
    sqft,
    propertyType: prop.PropertyType || prop.PropertySubType || null,
    daysOnMarket,
    onMarketDate,
    closeDate: prop.CloseDate ? new Date(prop.CloseDate) : null,
    listingUrl: `https://www.heartlandmls.com/listing/${prop.ListingId}`,
    photoUrls: photos.slice(0, 5),
    listAgentName: prop.ListAgentFullName || null,
    listAgentMlsId: prop.ListAgentMlsId || null,
    listOfficeName: prop.ListOfficeName || null,
    listOfficeMlsId: prop.ListOfficeMlsId || null,
    lat: prop.Latitude ?? null,
    lng: prop.Longitude ?? null,
    rawData: prop,
  };
}

/**
 * Fetch listings from MLS Grid, optionally filtering by status or
 * only fetching records modified after a given timestamp.
 */
export async function fetchListings(opts?: {
  status?: string;
  modifiedAfter?: Date;
  maxRecords?: number;
}): Promise<ParsedListing[]> {
  const { token, endpoint } = getConfig();
  const status = opts?.status;
  const modifiedAfter = opts?.modifiedAfter;
  const maxRecords = opts?.maxRecords ?? 50_000;

  const filterParts = [`OriginatingSystemName eq '${MLS_CODE}'`];
  if (status) filterParts.push(`StandardStatus eq '${status}'`);
  if (modifiedAfter) {
    filterParts.push(
      `ModificationTimestamp gt ${modifiedAfter.toISOString()}`
    );
  }

  const filter = filterParts.join(" and ");
  const results: ParsedListing[] = [];
  let url: string | null =
    `${endpoint}/Property?$filter=${encodeURIComponent(filter)}&$top=5000`;

  while (url && results.length < maxRecords) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Accept-Encoding": "gzip",
        "User-Agent": "TolleyIO-MLSGrid/1.0",
      },
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`MLS Grid API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data: MLSGridResponse = await res.json();

    for (const prop of data.value) {
      if (results.length >= maxRecords) break;
      results.push(parseProperty(prop));
    }

    url = data["@odata.nextLink"] || null;
  }

  return results;
}

/**
 * Incremental sync — only fetch listings modified since last sync.
 */
export async function fetchModifiedSince(since: Date): Promise<ParsedListing[]> {
  return fetchListings({ modifiedAfter: since });
}

/**
 * Full initial import of active listings.
 */
export async function fetchAllActive(): Promise<ParsedListing[]> {
  return fetchListings({ status: "Active" });
}
