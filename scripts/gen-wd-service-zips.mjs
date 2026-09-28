/**
 * One-time rebuild of lib/wd-service-zips.ts from Census centroids and drive times.
 *
 * Not imported by the app, and not part of `npm run build`. Run from the repo root:
 *   node scripts/gen-wd-service-zips.mjs
 *
 * Origin is the Census interior point of ZCTA 64052. Candidates are ZCTAs whose
 * centroids are within 40 straight-line miles. Drive minutes come from the public
 * OSRM demo table service (https://router.project-osrm.org).
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "lib/wd-service-zips.ts");
const GAZ_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_zcta_national.zip";
const PLACE_URL = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_place20_natl.txt";
const COUSUB_URL = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_cousub20_natl.txt";
const OSRM = "https://router.project-osrm.org/table/v1/driving/";
const ORIGIN_ZIP = "64052";
const STRAIGHT_MILES = 40;
const INCLUDE_MIN = 25;
const BORDER_MIN = 30;
const BATCH = 24;
const GENERATED = "2026-09-26";

const ORIGINAL = [
  "64050", "64052", "64053", "64054", "64055", "64056", "64057", "64058",
  "64013", "64014", "64015", "64016", "64029",
  "64133", "64138",
  "64063", "64064", "64081", "64082", "64086",
  "64120", "64123", "64124", "64125", "64126", "64127", "64128", "64129",
  "64118", "64119",
];

// USPS ZIPs that are not 2020+ ZCTAs. Used only to report a drive time.
const NON_ZCTA_ADDRESS = {
  "64013": { street: "100 SW Main St", city: "Blue Springs", state: "MO" },
};

function miles(a, b) {
  const r = 3958.7613;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLat = lat2 - lat1;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function round1(seconds) {
  return Math.round((seconds / 60) * 10) / 10;
}

const STATE_ABBR = { "20": "KS", "29": "MO" };

function placeLabel(name, geoid) {
  const bare = name
    .replace(/\s+(city|town|village|CDP|borough|municipality|township|CCD|metro township)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const state = STATE_ABBR[(geoid || "").slice(0, 2)];
  return state ? `${bare}, ${state}` : bare;
}

async function text(url) {
  const res = await fetch(url, { headers: { "User-Agent": "tolley-site-wd-zip-generator" } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

function bestName(rows) {
  const best = new Map();
  for (const row of rows) {
    const prev = best.get(row.zip);
    if (!prev || row.area > prev.area) best.set(row.zip, row);
  }
  return best;
}

function parseRelation(body, nameIndex) {
  const lines = body.replace(/^\uFEFF/, "").split(/\r?\n/);
  const rows = [];
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const p = line.split("|");
    const zip = (p[1] || "").trim();
    const name = placeLabel(p[nameIndex] || "", p[9] || "");
    const area = Number(p[16]) || 0;
    if (!/^\d{5}$/.test(zip) || !name) continue;
    rows.push({ zip, name, area });
  }
  return bestName(rows);
}

async function gazetteerText() {
  const res = await fetch(GAZ_URL, { headers: { "User-Agent": "tolley-site-wd-zip-generator" } });
  if (!res.ok) throw new Error(`Gazetteer returned ${res.status}`);
  const dir = mkdtempSync(join(tmpdir(), "wd-gaz-"));
  const zipPath = join(dir, "gaz.zip");
  writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  execFileSync("unzip", ["-o", zipPath, "-d", dir], { stdio: "ignore" });
  return readFileSync(join(dir, "2024_Gaz_zcta_national.txt"), "utf8").replace(/^\uFEFF/, "");
}

async function osrmMinutes(origin, points) {
  const out = new Map();
  for (let i = 0; i < points.length; i += BATCH) {
    const batch = points.slice(i, i + BATCH);
    const coords = [origin, ...batch].map((p) => `${p.lon},${p.lat}`).join(";");
    const url = `${OSRM}${coords}?sources=0&annotations=duration`;
    let body = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const res = await fetch(url, { headers: { "User-Agent": "tolley-site-wd-zip-generator" } });
      if (res.ok) {
        body = await res.json();
        break;
      }
      const snippet = (await res.text()).slice(0, 180);
      console.error(`OSRM ${res.status} batch ${i} attempt ${attempt}: ${snippet}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
    if (!body || body.code !== "Ok" || !body.durations?.[0]) {
      throw new Error(`OSRM batch starting at ${i} failed`);
    }
    batch.forEach((point, j) => {
      const seconds = body.durations[0][j + 1];
      out.set(point.zip, Number.isFinite(seconds) ? round1(seconds) : null);
    });
    await new Promise((r) => setTimeout(r, 1200));
  }
  return out;
}

function emitList(rows) {
  return rows.map((row) => `  // ${row.place}, ${row.minutes.toFixed(1)} min\n  "${row.zip}",`).join("\n");
}

const gaz = await gazetteerText();
const [headerLine, ...gazLines] = gaz.split(/\r?\n/).filter(Boolean);
const header = headerLine.split("\t").map((h) => h.trim());
const col = Object.fromEntries(header.map((name, i) => [name, i]));
const centroids = [];
for (const line of gazLines) {
  const p = line.split("\t");
  const zip = p[col.GEOID].trim();
  if (!/^\d{5}$/.test(zip)) continue;
  centroids.push({ zip, lat: Number(p[col.INTPTLAT]), lon: Number(p[col.INTPTLONG]) });
}
const origin = centroids.find((z) => z.zip === ORIGIN_ZIP);
if (!origin) throw new Error("Missing origin ZCTA 64052");
const candidates = centroids.filter((z) => miles(origin, z) <= STRAIGHT_MILES);
console.error(`Origin ${origin.lat}, ${origin.lon}; ${candidates.length} ZCTAs within ${STRAIGHT_MILES} miles`);

const [placeBody, cousubBody] = await Promise.all([text(PLACE_URL), text(COUSUB_URL)]);
const places = parseRelation(placeBody, 10);
const cousubs = parseRelation(cousubBody, 10);

const minutes = await osrmMinutes(origin, candidates);
const named = candidates.map((z) => ({
  zip: z.zip,
  minutes: minutes.get(z.zip),
  place: places.get(z.zip)?.name || cousubs.get(z.zip)?.name || "unincorporated",
  straight: miles(origin, z),
}));
const routed = named.filter((z) => z.minutes != null);
const unrouted = named.filter((z) => z.minutes == null);
const byMinutes = (a, b) => a.minutes - b.minutes || a.zip.localeCompare(b.zip);
const included = routed.filter((z) => z.minutes <= INCLUDE_MIN).sort(byMinutes);
const borderline = routed.filter((z) => z.minutes > INCLUDE_MIN && z.minutes <= BORDER_MIN).sort(byMinutes);
const cityLabels = [];
for (const row of included) {
  if (!cityLabels.includes(row.place)) cityLabels.push(row.place);
}

const nonZcta = [];
for (const zip of ORIGINAL) {
  if (named.some((z) => z.zip === zip)) continue;
  const hint = NON_ZCTA_ADDRESS[zip];
  const query = hint
    ? `street=${encodeURIComponent(hint.street)}&city=${encodeURIComponent(hint.city)}&state=${hint.state}&zip=${zip}`
    : `street=1&city=&state=&zip=${zip}`;
  const geo = await fetch(`https://geocoding.geo.census.gov/geocoder/geographies/address?${query}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`);
  let place = hint ? `${hint.city}, ${hint.state}` : "—";
  let minutes = null;
  if (geo.ok) {
    const found = (await geo.json()).result?.addressMatches?.[0]?.coordinates;
    if (found) {
      const timed = await osrmMinutes(origin, [{ zip, lat: found.y, lon: found.x }]);
      minutes = timed.get(zip) ?? null;
    }
  }
  nonZcta.push({ zip, place, minutes });
}
const nonZctaComment = nonZcta.map((row) => {
  const timing = row.minutes == null
    ? "No drive time was available, so it is not in either list."
    : `A Census geocode is about ${row.minutes.toFixed(1)} driving minutes. It is not in either list; add it by hand if it should be served.`;
  return ` * ${row.zip} (${row.place}) is not a 2024 Census ZCTA. ${timing}`;
}).join("\n");

const source = `/**
 * Washer & dryer delivery ZIPs by driving time.
 *
 * Origin: interior point (INTPTLAT/INTPTLONG) of ZCTA 64052, Independence, MO
 * (${origin.lat}, ${origin.lon}) from the US Census 2024 Gazetteer national ZCTA file
 * (2024_Gaz_zcta_national.zip). Place names are the 2020 Census ZCTA-to-place
 * relationship (largest land overlap), with county subdivision as a fallback.
 * Drive times are from the public OSRM demo table service
 * (https://router.project-osrm.org/table/v1/driving, sources=0), generated ${GENERATED}.
 * Candidates were every ZCTA whose centroid is within ${STRAIGHT_MILES} straight-line miles.
 *
 * This list is static and hand-editable. The owner may trim or extend it.
 * It is the single source of truth for washer/dryer delivery. Rebuild later with
 * \`node scripts/gen-wd-service-zips.mjs\`. That script does not run at build time
 * or at runtime.
 *
 * WD_SERVICE_ZIPS is every routed ZIP at ${INCLUDE_MIN.toFixed(1)} driving minutes or less.
 * WD_BORDERLINE_ZIPS is just over ${INCLUDE_MIN.toFixed(1)} minutes through ${BORDER_MIN.toFixed(1)} minutes.
 * Borderline ZIPs are exported so the owner can move them up. isWdServiceZip does not allow them.
${nonZctaComment ? `${nonZctaComment}\n` : ""} */
export const WD_SERVICE_ZIPS = [
${emitList(included)}
] as const;

/**
 * Borderline: just over ${INCLUDE_MIN.toFixed(1)} driving minutes and at most ${BORDER_MIN.toFixed(1)}.
 * Not a delivery area. Move an entry into WD_SERVICE_ZIPS to start serving it.
 */
export const WD_BORDERLINE_ZIPS = [
${emitList(borderline)}
] as const;

/** City labels shown on /wd, in order of the closest included ZIP for that place. */
export const WD_SERVICE_CITY_LABELS = [
${cityLabels.map((city) => `  ${JSON.stringify(city)},`).join("\n")}
] as const;

export const WD_OUT_OF_AREA_MESSAGE =
  "Thank you so much for your interest! Right now we only service within about 25 minutes of Independence, so we can't deliver to your area. Leave your number and we'll reach out if that changes.";

const WD_SERVICE_ZIP_SET = new Set<string>(WD_SERVICE_ZIPS);

/** Trim, keep digits, and use the first 5. Returns null when fewer than 5 digits. */
export function normalizeWdZip(input: string): string | null {
  const digits = input.trim().replace(/\\D/g, "");
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
 * \`outOfArea\` is set here and must not be taken from the client.
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
`;

writeFileSync(OUT, source);
const byZip = new Map(named.map((z) => [z.zip, z]));
console.log(`Included ${included.length}; borderline ${borderline.length}; no route ${unrouted.length}`);
console.log("\n## Included (<= 25.0 min)\n");
console.log("| ZIP | Place | Minutes |");
console.log("| --- | --- | ---: |");
for (const row of included) console.log(`| ${row.zip} | ${row.place} | ${row.minutes.toFixed(1)} |`);
console.log("\n## Borderline (> 25.0 and <= 30.0 min)\n");
console.log("| ZIP | Place | Minutes |");
console.log("| --- | --- | ---: |");
for (const row of borderline) console.log(`| ${row.zip} | ${row.place} | ${row.minutes.toFixed(1)} |`);
console.log("\n## Original hand list over 25 minutes or excluded\n");
console.log("| ZIP | Place | Minutes | Result |");
console.log("| --- | --- | ---: | --- |");
for (const zip of ORIGINAL) {
  const row = byZip.get(zip);
  if (!row) {
    const extra = nonZcta.find((item) => item.zip === zip);
    const minutesCell = extra?.minutes == null ? "—" : extra.minutes.toFixed(1);
    const detail = extra?.minutes == null
      ? "excluded: not a 2024 Census ZCTA"
      : `excluded: not a 2024 Census ZCTA; Census-geocoded drive time ${extra.minutes.toFixed(1)} min`;
    console.log(`| ${zip} | ${extra?.place ?? "—"} | ${minutesCell} | ${detail} |`);
    continue;
  }
  if (row.minutes == null) {
    console.log(`| ${zip} | ${row.place} | — | excluded: OSRM returned no route |`);
    continue;
  }
  if (row.minutes > INCLUDE_MIN) {
    const bucket = row.minutes <= BORDER_MIN ? "borderline, not allowed" : "excluded, over 30 min";
    console.log(`| ${zip} | ${row.place} | ${row.minutes.toFixed(1)} | ${bucket} |`);
  }
}
if (unrouted.length) {
  console.log("\nUnrouted candidates:", unrouted.map((z) => z.zip).join(", "));
}
