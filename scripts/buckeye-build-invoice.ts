/**
 * Buckeye weekly DRAFT invoice builder.
 *
 * Consumes the extractor's weekly state JSON
 * (/home/jelly/Shared/Buckeye-Deliveries/state/week-YYYY-Www.json), computes each
 * day's optimized ONE-WAY route mileage (Riverside -> stops in shortest order, no
 * return leg), and creates ONE DRAFT invoice in the tolley.io invoicing system:
 *   - one line per stop, description "Name M/D"
 *   - quantity = leg miles, unitAmount = $2.80/mile
 *   - source packing-slip PDFs attached (Alicia requires packing slips)
 *   - invoice number continues the Buckeye INV-### sequence
 *   - status = DRAFT (never auto-sent)
 * Then pings Telegram with a review summary.
 *
 *   npx tsx scripts/buckeye-build-invoice.ts                # build current ISO week
 *   npx tsx scripts/buckeye-build-invoice.ts --week 2026-W23
 *   npx tsx scripts/buckeye-build-invoice.ts --file /abs/path/week.json
 *   npx tsx scripts/buckeye-build-invoice.ts --dry-run      # compute + print, write nothing
 *   npx tsx scripts/buckeye-build-invoice.ts --force        # rebuild even if already built
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { syncBuckeyeMileage } from '../lib/account/invoice-mileage';

const prisma = new PrismaClient();

// ----- config
const SHARED = '/home/jelly/Shared/Buckeye-Deliveries';
const STATE_DIR = join(SHARED, 'state');
const PROCESSED_DIR = join(SHARED, 'processed');
const ORIGIN_ADDRESS = '244 NW Plaza Dr, Riverside, MO 64150';
const RATE_PER_MILE = 2.8;
const DUE_DAYS = 14;

const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
// --refresh: daily-safe rebuild. Replaces the current week's auto-draft in place
// (reusing the SAME invoice number) when new slips have been dropped, and is a
// clean no-op when nothing changed or the invoice has already been sent.
const REFRESH = process.argv.includes('--refresh');

function argVal(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

// ----- env loader: Prisma auto-loads .env, but Maps/Telegram/Blob live in the
// .env.local / .env.production.local files. Pull the keys we need without clobbering.
function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(join(process.cwd(), '.env.local'));
loadEnvFile(join(process.cwd(), '.env.production.local'));
loadEnvFile(join(process.cwd(), '.env'));

const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

// ----- types
interface Slip {
  shipToName: string;
  shipToAddress: string;
  shipDate: string | null;
  rawDateText: string | null;
  lowConfidence?: boolean;
  sourceFile: string;
}
interface Geo { lat: number; lng: number; formattedAddress: string }

function log(...a: unknown[]) {
  console.log('[buckeye-build]', ...a);
}

function isoWeekKey(d = new Date()): string {
  // ISO week (Mon-Sun). Sunday belongs to the week that just ended.
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function mdLabel(isoDate: string): string {
  // "2026-05-19" -> "5/19"
  const [, m, d] = isoDate.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

/**
 * Custom mileage rounding (user rule):
 *   tenths .1/.2/.3  -> round DOWN (floor)
 *   tenths .4/.5/.6/.7 -> keep as-is
 *   tenths .8/.9      -> round UP (ceil)
 * Mileage already comes in at one decimal place.
 */
function roundMiles(m: number): number {
  const whole = Math.floor(m);
  const tenth = Math.round((m - whole) * 10); // 0..10
  if (tenth >= 8) return whole + 1;
  if (tenth <= 3) return whole;
  return whole + tenth / 10;
}

// ----- Google Maps helpers (same URL patterns as lib/dispatch/geocode.ts)
const geoCache = new Map<string, Geo | null>();
async function geocodeGoogle(address: string): Promise<Geo | null> {
  if (!MAPS_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data.results?.[0];
    if (r) return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, formattedAddress: r.formatted_address };
  } catch { /* fall through to free provider */ }
  return null;
}

// Packing-slip addresses often carry "ATTN: <name/dept>" lines and hard newlines
// that break the free geocoder — strip them down to the mailing address.
function cleanAddress(a: string): string {
  return a
    .replace(/\r?\n/g, ' ')
    .replace(/ATTN[:\s][^0-9]*/i, '') // drop "ATTN: Name /Dept" up to the street number
    .replace(/\s+/g, ' ')
    .trim();
}

// Free fallback geocoder (OpenStreetMap Nominatim). Used when Google is unavailable
// (e.g. Cloud billing disabled). Usage policy: <=1 req/sec + a real User-Agent.
let nominatimLast = 0;
async function nominatimQuery(q: string): Promise<Geo | null> {
  const wait = 1100 - (Date.now() - nominatimLast);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  nominatimLast = Date.now();
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=us`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'tolley-buckeye-invoice/1.0 (jared@yourkchomes.com)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const r = Array.isArray(data) ? data[0] : null;
    if (r) return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), formattedAddress: r.display_name };
  } catch { /* no geocode available */ }
  return null;
}

async function geocodeNominatim(address: string): Promise<Geo | null> {
  const cleaned = cleanAddress(address);
  const hit = await nominatimQuery(cleaned);
  if (hit) return hit;
  // Fallback: a misspelled street (e.g. "COMMERICIAL") won't match — geocode the ZIP
  // centroid so the stop still gets ~accurate mileage instead of a blank $0 line.
  const zip = cleaned.match(/\b(\d{5})\b/)?.[1];
  if (zip) return nominatimQuery(`${zip}, USA`);
  return null;
}

async function geocode(address: string): Promise<Geo | null> {
  if (geoCache.has(address)) return geoCache.get(address)!;
  let out = await geocodeGoogle(address);
  if (!out) out = await geocodeNominatim(address);
  geoCache.set(address, out);
  return out;
}

/** Full driving-distance matrix (miles) over points; chunks to stay <=100 elements/request. */
async function distanceMatrixGoogle(points: Geo[]): Promise<number[][]> {
  const n = points.length;
  const out: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const destStr = points.map((p) => `${p.lat},${p.lng}`).join('|');
  const perReq = Math.max(1, Math.floor(100 / n)); // origins per request
  for (let i = 0; i < n; i += perReq) {
    const chunk = points.slice(i, i + perReq);
    const originStr = chunk.map((p) => `${p.lat},${p.lng}`).join('|');
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}` +
      `&destinations=${destStr}&units=imperial&mode=driving&key=${MAPS_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Distance Matrix HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'OK') throw new Error(`Distance Matrix status ${data.status}: ${data.error_message || ''}`);
    data.rows.forEach((row: any, ri: number) => {
      row.elements.forEach((el: any, ci: number) => {
        out[i + ri][ci] = el.status === 'OK' ? el.distance.value / 1609.34 : Infinity;
      });
    });
  }
  return out;
}

// Free fallback router (public OSRM). Returns a full driving-distance matrix in miles.
async function distanceMatrixOSRM(points: Geo[]): Promise<number[][]> {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/table/v1/driving/${coords}?annotations=distance`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok' || !Array.isArray(data.distances)) throw new Error(`OSRM code ${data.code}`);
  return data.distances.map((row: (number | null)[]) => row.map((m) => (m == null ? Infinity : m / 1609.34)));
}

async function distanceMatrix(points: Geo[]): Promise<number[][]> {
  if (MAPS_KEY) {
    try { return await distanceMatrixGoogle(points); }
    catch (e) { log(`Google Distance Matrix unavailable (${(e as Error).message}); using free OSRM router.`); }
  }
  return distanceMatrixOSRM(points);
}

/**
 * Open-path TSP: fixed start at index 0 (origin), visit all of 1..n, free end,
 * minimize total driving distance. Held-Karp for small n; nearest-neighbor + 2-opt fallback.
 * Returns the visiting order of STOPS (0-based into the stops array) and the per-leg miles
 * (leg[k] = miles from the previous point into stop order[k]).
 */
function optimizeRoute(matrix: number[][]): { order: number[]; legs: number[] } {
  const n = matrix.length - 1; // number of stops (index 0 is origin)
  if (n === 0) return { order: [], legs: [] };
  if (n === 1) return { order: [0], legs: [matrix[0][1]] };

  let order: number[];
  if (n <= 12) order = heldKarp(matrix, n);
  else order = twoOpt(nearestNeighbor(matrix, n), matrix);

  const legs: number[] = [];
  let prev = 0; // origin
  for (const s of order) {
    legs.push(matrix[prev][s + 1]);
    prev = s + 1;
  }
  return { order, legs };
}

function heldKarp(matrix: number[][], n: number): number[] {
  const FULL = 1 << n;
  const dp = Array.from({ length: FULL }, () => new Array(n).fill(Infinity));
  const par = Array.from({ length: FULL }, () => new Array(n).fill(-1));
  for (let j = 0; j < n; j++) dp[1 << j][j] = matrix[0][j + 1];
  for (let mask = 1; mask < FULL; mask++) {
    for (let j = 0; j < n; j++) {
      if (!(mask & (1 << j)) || dp[mask][j] === Infinity) continue;
      for (let k = 0; k < n; k++) {
        if (mask & (1 << k)) continue;
        const nm = mask | (1 << k);
        const cand = dp[mask][j] + matrix[j + 1][k + 1];
        if (cand < dp[nm][k]) { dp[nm][k] = cand; par[nm][k] = j; }
      }
    }
  }
  let best = Infinity, end = 0;
  for (let j = 0; j < n; j++) if (dp[FULL - 1][j] < best) { best = dp[FULL - 1][j]; end = j; }
  const order: number[] = [];
  let mask = FULL - 1, j = end;
  while (j !== -1) { order.push(j); const pj = par[mask][j]; mask ^= 1 << j; j = pj; }
  return order.reverse();
}

function nearestNeighbor(matrix: number[][], n: number): number[] {
  const visited = new Array(n).fill(false);
  const order: number[] = [];
  let cur = 0; // origin
  for (let step = 0; step < n; step++) {
    let best = -1, bd = Infinity;
    for (let k = 0; k < n; k++) {
      if (visited[k]) continue;
      const d = matrix[cur][k + 1];
      if (d < bd) { bd = d; best = k; }
    }
    visited[best] = true; order.push(best); cur = best + 1;
  }
  return order;
}

function pathLen(order: number[], matrix: number[][]): number {
  let prev = 0, total = 0;
  for (const s of order) { total += matrix[prev][s + 1]; prev = s + 1; }
  return total;
}

function twoOpt(order: number[], matrix: number[][]): number[] {
  let best = order.slice(), improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const cand = best.slice(0, i).concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
        if (pathLen(cand, matrix) + 1e-9 < pathLen(best, matrix)) { best = cand; improved = true; }
      }
    }
  }
  return best;
}

// ----- contact + invoice number (mirrors buckeye-inspect.ts / buckeye-rename.ts conventions)
async function resolveBuckeye() {
  const contacts = await prisma.accountContact.findMany({
    where: {
      OR: [
        { name: { contains: 'Buckeye', mode: 'insensitive' } },
        { email: { contains: 'buckeye', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true },
  });
  if (!contacts.length) throw new Error('No Buckeye AccountContact found');
  const ids = contacts.map((c) => c.id);

  const invoices = await prisma.invoice.findMany({
    where: { contactId: { in: ids } },
    select: { invoiceNumber: true, contactId: true, issueDate: true },
    orderBy: { issueDate: 'desc' },
  });

  // Bill to the contact the most-recent Buckeye invoice used (consistency), else
  // prefer the dedicated "Buckeye Invoice" billing contact, else the first match.
  let billToId = invoices[0]?.contactId || null;
  if (!billToId) {
    const billing = contacts.find((c) => /invoice/i.test(c.name)) || contacts[0];
    billToId = billing.id;
  }
  const billTo = contacts.find((c) => c.id === billToId) || contacts[0];

  // Next Buckeye number: max of the TRUE Buckeye-facing sequence + 1.
  // The real sequence is UNPADDED "INV-<n>" (e.g. INV-147). Zero-padded "INV-0302"
  // and named "INV-Guadalupe" forms are global-auto-counter / Xero artifacts that
  // do NOT belong to Buckeye's sequence — exclude them or numbering jumps wildly.
  let maxNum = 0;
  for (const inv of invoices) {
    const m = inv.invoiceNumber.match(/^INV-([1-9]\d*)$/); // no leading zero
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  let nextNum = Math.max(maxNum + 1, 148); // memory: real sequence reached 147, next is >=148
  let invoiceNumber = `INV-${nextNum}`;
  let collisionBumped = false;
  // Guard against a GLOBAL collision (numbers are unique repo-wide). Bump loudly if hit.
  while (await prisma.invoice.findUnique({ where: { invoiceNumber }, select: { id: true } })) {
    collisionBumped = true;
    nextNum += 1;
    invoiceNumber = `INV-${nextNum}`;
  }
  return { billTo, contactIds: ids, invoiceNumber, collisionBumped };
}

async function findMileageAccountId(): Promise<string | null> {
  const acct = await prisma.ledgerAccount.findFirst({
    where: {
      OR: [
        { name: { contains: 'milage', mode: 'insensitive' } },
        { name: { contains: 'mileage', mode: 'insensitive' } },
        { code: '4040' },
      ],
    },
    select: { id: true, name: true, code: true },
  });
  if (acct) log(`mileage revenue account: ${acct.code} ${acct.name}`);
  return acct?.id || null;
}

// ----- Telegram notify (best-effort)
async function notify(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) { log('Telegram creds missing; skipping notify'); return; }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
    });
  } catch (e) {
    log('notify failed:', e);
  }
}

// ----- attachments (best-effort; needs BLOB_READ_WRITE_TOKEN)
async function attachPackingSlips(invoiceId: string, files: string[]) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) { log('BLOB_READ_WRITE_TOKEN missing; SKIPPING attachments (attach packing slips manually!)'); return 0; }
  const { put } = await import('@vercel/blob');
  let n = 0;
  for (const fname of files) {
    const path = join(PROCESSED_DIR, fname);
    if (!existsSync(path)) { log(`  attachment source missing: ${fname}`); continue; }
    try {
      const buf = readFileSync(path);
      const blob = await put(`buckeye-packing-slips/${invoiceId}/${fname}`, buf, {
        access: 'public', token, contentType: 'application/pdf', addRandomSuffix: true,
      });
      await prisma.invoiceAttachment.create({
        data: { invoiceId, fileName: fname, mimeType: 'application/pdf', size: buf.length, blobUrl: blob.url },
      });
      n++;
    } catch (e) {
      log(`  attachment failed for ${fname}:`, e);
    }
  }
  return n;
}

// ----- main
async function main() {
  if (!MAPS_KEY) log('GOOGLE_MAPS_API_KEY not set — using free Nominatim + OSRM providers.');

  const week = argVal('--week') || isoWeekKey();
  const statePath = argVal('--file') || join(STATE_DIR, `week-${week}.json`);
  if (!existsSync(statePath)) throw new Error(`State file not found: ${statePath}`);
  const state = JSON.parse(readFileSync(statePath, 'utf8'));

  const slips: Slip[] = state.slips || [];
  if (!slips.length) { log(`No slips in ${statePath}; nothing to build.`); return; }

  // Signature of the current slip set. Lets the nightly --refresh run skip cleanly
  // when nothing new was dropped (no duplicate Telegram ping, no pointless Blob
  // re-upload) and rebuild only when the batch actually changed.
  const slipsSig = JSON.stringify(
    slips.map((s) => [s.shipDate || '', s.shipToName, s.shipToAddress, s.sourceFile]).sort(),
  );

  if (state.builtInvoiceId) {
    const existing = await prisma.invoice.findUnique({
      where: { id: state.builtInvoiceId },
      select: { status: true, invoiceNumber: true },
    });
    if (!existing) {
      // Draft was deleted out from under us — forget it and rebuild fresh.
      delete state.builtInvoiceId; delete state.builtInvoiceNumber;
    } else if (existing.status !== 'DRAFT') {
      // Already sent / finalized this week — never clobber it.
      log(`Week ${week} invoice ${existing.invoiceNumber} is ${existing.status} (not a draft) — leaving it alone. Nothing to do.`);
      return;
    } else if (!FORCE && !REFRESH) {
      log(`Week ${week} already built draft ${existing.invoiceNumber}. Use --refresh (or --force) to rebuild.`);
      return;
    } else if (REFRESH && !FORCE && state.builtSlipsSig === slipsSig) {
      log(`Week ${week} draft ${existing.invoiceNumber} already reflects all ${slips.length} slip(s) — no change, skipping.`);
      return;
    } else {
      // Replace the auto-draft in place: delete it (cascades line items + attachments)
      // so the rebuild REUSES the same invoice number (INV-148 stays INV-148) instead
      // of piling up a new number every night.
      await prisma.invoice.delete({ where: { id: state.builtInvoiceId } });
      log(`Replaced prior draft ${existing.invoiceNumber} (${state.builtInvoiceId}).`);
      delete state.builtInvoiceId; delete state.builtInvoiceNumber;
    }
  }

  // Group by ship date; dedupe identical (name+addr) within a date. Null-date slips
  // can't be routed -> collect for manual handling.
  // Dedupe on date + NORMALIZED NAME (not address): a multi-page order or an OCR
  // misread (e.g. zip 66205 vs 66206) for the same stop on the same day must collapse
  // to one line. Different dates for the same place stay separate (real repeat trips).
  // A repeat of the SAME stop on the SAME day (multi-page order or OCR zip-misread) is
  // NOT dropped — it becomes a $0 line (no extra travel, but still listed so the invoice
  // matches the stack of packing slips 1:1). Different dates for the same place stay.
  const byDate = new Map<string, Slip[]>();      // unique billable stops per date
  const dupsByDate = new Map<string, Slip[]>();   // same-stop-same-day repeats -> $0 lines
  const noDate: Slip[] = [];
  const seen = new Set<string>();
  for (const s of slips) {
    if (!s.shipDate) { noDate.push(s); continue; }
    const normName = s.shipToName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = `${s.shipDate}|${normName}`;
    if (seen.has(key)) {
      if (!dupsByDate.has(s.shipDate)) dupsByDate.set(s.shipDate, []);
      dupsByDate.get(s.shipDate)!.push(s);
      log(`  ($0 duplicate: ${s.shipToName} ${s.shipDate} — same stop/day)`);
      continue;
    }
    seen.add(key);
    if (!byDate.has(s.shipDate)) byDate.set(s.shipDate, []);
    byDate.get(s.shipDate)!.push(s);
  }

  const origin = await geocode(ORIGIN_ADDRESS);
  if (!origin) throw new Error('Failed to geocode the Riverside origin address');

  type Line = { description: string; quantity: number; unitAmount: number; date: string; flag?: string };
  const lines: Line[] = [];
  const failedGeo: Slip[] = [];
  const sourceFiles = new Set<string>();
  const dates = [...byDate.keys()].sort();

  for (const date of dates) {
    const dayStops = byDate.get(date)!;
    const geos: Geo[] = [];
    const kept: Slip[] = [];
    for (const s of dayStops) {
      sourceFiles.add(s.sourceFile);
      const g = await geocode(s.shipToAddress);
      if (!g) { failedGeo.push(s); continue; }
      geos.push(g); kept.push(s);
    }
    if (!kept.length) continue;

    const matrix = await distanceMatrix([origin, ...geos]);
    const { order, legs } = optimizeRoute(matrix);

    log(`\n${date} — optimized one-way route (${kept.length} stop${kept.length > 1 ? 's' : ''}):`);
    let dayMiles = 0;
    order.forEach((stopIdx, k) => {
      const s = kept[stopIdx];
      const miles = roundMiles(legs[k]);
      dayMiles += miles;
      log(`  ${k + 1}. ${s.shipToName}  (${legs[k].toFixed(1)}→${miles} mi @ $${RATE_PER_MILE}) = $${(miles * RATE_PER_MILE).toFixed(2)}`);
      lines.push({ description: `${s.shipToName} ${mdLabel(date)}`, quantity: miles, unitAmount: RATE_PER_MILE, date });
    });
    // Same-stop-same-day repeats: listed at $0 (no extra travel).
    for (const dup of dupsByDate.get(date) || []) {
      log(`  +. ${dup.shipToName}  ($0 — same stop/day)`);
      lines.push({ description: `${dup.shipToName} ${mdLabel(date)}`, quantity: 0, unitAmount: RATE_PER_MILE, date });
    }
    log(`  day total: ${Math.round(dayMiles * 10) / 10} mi = $${(dayMiles * RATE_PER_MILE).toFixed(2)}`);
  }

  // Geocode failures + no-date slips become visible (zero-mile) lines so they show in the
  // DRAFT for manual mileage entry, rather than silently vanishing.
  for (const s of failedGeo) {
    sourceFiles.add(s.sourceFile);
    lines.push({
      description: `${s.shipToName} ${s.shipDate ? mdLabel(s.shipDate) : '(date?)'} — MILEAGE TBD (address not found)`,
      quantity: 0, unitAmount: RATE_PER_MILE, date: s.shipDate || '', flag: 'geo',
    });
  }
  for (const s of noDate) {
    sourceFiles.add(s.sourceFile);
    lines.push({
      description: `${s.shipToName} — DATE TBD${s.rawDateText ? ` (saw "${s.rawDateText}")` : ''}`,
      quantity: 0, unitAmount: RATE_PER_MILE, date: '', flag: 'date',
    });
  }

  if (!lines.length) { log('No billable lines produced.'); return; }

  const subTotal = lines.reduce((s, l) => s + Math.round(l.quantity * l.unitAmount * 100) / 100, 0);
  const total = Math.round(subTotal * 100) / 100;

  const { billTo, invoiceNumber, collisionBumped } = await resolveBuckeye();
  const accountId = await findMileageAccountId();

  const flags: string[] = [];
  if (failedGeo.length) flags.push(`${failedGeo.length} stop(s) need manual mileage (geocode failed)`);
  if (noDate.length) flags.push(`${noDate.length} slip(s) missing a ship date`);
  if (collisionBumped) flags.push(`invoice number bumped past a global collision — verify ${invoiceNumber} is the right Buckeye number`);
  const lowConfWarn = flags.length ? `\n\n⚠️ NEEDS ATTENTION:\n- ${flags.join('\n- ')}` : '';

  const firstDate = dates[0] || '';
  const lastDate = dates[dates.length - 1] || '';
  const reference = firstDate ? `Deliveries ${mdLabel(firstDate)}–${lastDate ? mdLabel(lastDate) : ''}` : `Week ${week}`;
  // User: no auto-notes on the invoice. Any flags surface only in the Telegram ping.
  const notes: string | null = null;

  log(`\n=== DRAFT SUMMARY ===`);
  log(`bill to:        ${billTo.name} <${billTo.email || 'no-email'}>`);
  log(`invoice number: ${invoiceNumber}${collisionBumped ? '  (COLLISION-BUMPED)' : ''}`);
  log(`reference:      ${reference}`);
  log(`lines:          ${lines.length}  (${dates.length} day(s))`);
  log(`total:          $${total.toFixed(2)}`);
  log(`attachments:    ${sourceFiles.size} packing slip PDF(s)`);
  if (flags.length) log(`FLAGS:          ${flags.join(' | ')}`);

  if (DRY) {
    log('\n--dry-run: nothing written. Line items that WOULD be created:');
    lines.forEach((l) => log(`   ${l.description}  | qty ${l.quantity} × $${l.unitAmount} = $${(l.quantity * l.unitAmount).toFixed(2)}`));
    await prisma.$disconnect();
    return;
  }

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      contactId: billTo.id,
      status: 'DRAFT',
      dueDate: new Date(Date.now() + DUE_DAYS * 86400000),
      reference,
      notes,
      subTotal,
      total,
      amountDue: total,
      lineItems: {
        create: lines.map((l, index) => ({
          description: l.description,
          quantity: l.quantity,
          unitAmount: l.unitAmount,
          lineAmount: Math.round(l.quantity * l.unitAmount * 100) / 100,
          accountId,
          sortOrder: index,
        })),
      },
    },
    include: { lineItems: true },
  });
  log(`\nCreated DRAFT invoice ${invoice.invoiceNumber} (${invoice.id})`);

  const attached = await attachPackingSlips(invoice.id, [...sourceFiles]);
  log(`attached ${attached}/${sourceFiles.size} packing slip(s)`);

  // Mark the week built so the Sunday timer never double-creates (Alicia de-dupes invoices).
  state.builtInvoiceId = invoice.id;
  state.builtInvoiceNumber = invoice.invoiceNumber;
  state.builtSlipsSig = slipsSig;
  state.builtAt = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  // Auto-log the round-trip business mileage for this week's delivery days into
  // the IRS MileageTrip log (gap-filled: days already tracked are skipped). This
  // is what replaces MileIQ going forward.
  let mileageNote = '';
  try {
    const m = await syncBuckeyeMileage({ from: firstDate, to: lastDate });
    if (m.tripsInserted) mileageNote = `\n🚗 Logged ${m.tripsInserted} mileage leg(s) across ${m.daysGapFilled} day(s).`;
    log(`mileage sync: +${m.tripsInserted} trips (${m.daysGapFilled} days, ${m.daysSkipped} already tracked)`);
  } catch (e: unknown) {
    log(`mileage sync failed (non-fatal): ${(e as Error)?.message || e}`);
  }

  await notify(
    `🧾 *Buckeye draft ${invoice.invoiceNumber}* ready — *$${total.toFixed(2)}*\n` +
      `${lines.length} stop(s) across ${dates.length} day(s), ${attached} packing slip(s) attached.\n` +
      `Review & send: tolley.io/account/invoices${mileageNote}${lowConfWarn}`,
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await notify(`❌ Buckeye invoice build FAILED: ${e?.message || e}`);
  await prisma.$disconnect();
  process.exit(1);
});
