/**
 * Invoice/delivery -> MileageTrip sync (the MileIQ replacement).
 *
 * Source of truth = the Buckeye weekly state JSONs in
 * ~/Shared/Buckeye-Deliveries/state/week-YYYY-Www.json (shipToName /
 * shipToAddress / shipDate per packing slip — the same data the weekly
 * invoice is built from). For each delivery DAY we reconstruct the real
 * ROUND TRIP actually driven:
 *
 *     HOME -> PICKUP (Riverside) -> [delivery stops] -> HOME
 *
 * The Buckeye invoice only bills the one-way pickup->stops legs; for the IRS
 * log we add the home->pickup and last-stop->home legs so the deduction
 * reflects the full business miles driven.
 *
 * GAP-FILL BY DAY: if a calendar day already has ANY MileageTrip (e.g. from
 * the MileIQ import that covers Jan 1 - Jun 24 2026), that whole day is
 * skipped so business miles are never double-counted. Days MileIQ never saw
 * (going forward, after MileIQ is cancelled) get logged automatically.
 */
import { readdirSync, readFileSync, existsSync } from "fs";
import { prisma } from "@/lib/prisma";
import { geocodeAddress, getDistance } from "@/lib/dispatch/geocode";

const HOME = "11913 Mar Bec Trail, Independence, MO, 64052, United States";
const PICKUP = "244 NW Plaza Dr, Riverside, MO 64150"; // Buckeye product pickup
const IRS_BUSINESS_RATE = 0.725; // 2026
const STATE_DIR = "/home/jelly/Shared/Buckeye-Deliveries/state";

type Slip = {
  shipToName: string;
  shipToAddress: string;
  shipDate?: string;
};

type LegResult = {
  startAddr: string;
  stopAddr: string;
  miles: number;
};

type GeoPt = { lat: number; lng: number };

const geoCache = new Map<string, GeoPt | null>();
async function geo(addr: string): Promise<GeoPt | null> {
  const key = addr.trim().replace(/\s+/g, " ");
  if (geoCache.has(key)) return geoCache.get(key)!;
  const g = await geocodeAddress(key);
  const pt = g ? { lat: g.lat, lng: g.lng } : null;
  geoCache.set(key, pt);
  return pt;
}

function haversine(a: GeoPt, b: GeoPt): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Real driving miles between two addresses (Google Distance Matrix), 0 on failure.
async function drive(aAddr: string, bAddr: string): Promise<number> {
  const a = await geo(aAddr);
  const b = await geo(bAddr);
  if (!a || !b) return 0;
  const d = await getDistance(a.lat, a.lng, b.lat, b.lng);
  return d ? d.distanceMi : 0;
}

/**
 * Build the round-trip legs for one delivery day.
 * Stops are ordered by nearest-neighbor (haversine) starting from PICKUP;
 * per-leg miles are real driving distances.
 */
export async function buildDayTrips(stops: Slip[]): Promise<LegResult[]> {
  const valid: { slip: Slip; pt: GeoPt }[] = [];
  for (const s of stops) {
    if (!s.shipToAddress) continue;
    const pt = await geo(s.shipToAddress);
    if (pt) valid.push({ slip: s, pt });
  }
  if (!valid.length) return [];

  const pickupPt = await geo(PICKUP);

  // nearest-neighbor order from pickup
  const ordered: { slip: Slip; pt: GeoPt }[] = [];
  const remaining = [...valid];
  let cur = pickupPt || valid[0].pt;
  while (remaining.length) {
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(cur, remaining[i].pt);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    ordered.push(remaining[bestI]);
    cur = remaining[bestI].pt;
    remaining.splice(bestI, 1);
  }

  // sequence of addresses: HOME -> PICKUP -> stops... -> HOME
  const seq = [HOME, PICKUP, ...ordered.map((o) => o.slip.shipToAddress), HOME];
  const legs: LegResult[] = [];
  for (let i = 0; i < seq.length - 1; i++) {
    const miles = await drive(seq[i], seq[i + 1]);
    if (miles > 0) legs.push({ startAddr: seq[i], stopAddr: seq[i + 1], miles });
  }
  return legs;
}

// True if a calendar day already has any logged trip (MileIQ or prior sync).
async function dayHasTrips(dateISO: string): Promise<boolean> {
  const start = new Date(`${dateISO}T00:00:00`);
  const end = new Date(`${dateISO}T23:59:59`);
  const n = await prisma.mileageTrip.count({
    where: { startDate: { gte: start, lte: end } },
  });
  return n > 0;
}

// True if an address-needle already appears in a logged trip within ±window days
// of the date. Used for Wayne, whose invoices are issued days AFTER the drive
// MileIQ already captured — so a same-day check isn't enough to avoid double-count.
async function pickupTrackedNear(
  dateISO: string,
  needle: string,
  windowDays = 4
): Promise<boolean> {
  const d = new Date(`${dateISO}T12:00:00`);
  const start = new Date(d.getTime() - windowDays * 86400000);
  const end = new Date(d.getTime() + windowDays * 86400000);
  const n = await prisma.mileageTrip.count({
    where: {
      startDate: { gte: start, lte: end },
      OR: [{ startAddr: { contains: needle } }, { stopAddr: { contains: needle } }],
    },
  });
  return n > 0;
}

export type SyncResult = {
  daysScanned: number;
  daysGapFilled: number;
  daysSkipped: number;
  tripsInserted: number;
  details: { date: string; status: string; trips?: number; miles?: number }[];
};

/**
 * Sync Buckeye delivery mileage into MileageTrip.
 * @param opts.from/to  ISO date bounds (inclusive). Omit for all available.
 * @param opts.dryRun   compute but don't write.
 */
export async function syncBuckeyeMileage(
  opts: { from?: string; to?: string; dryRun?: boolean } = {}
): Promise<SyncResult> {
  const result: SyncResult = {
    daysScanned: 0,
    daysGapFilled: 0,
    daysSkipped: 0,
    tripsInserted: 0,
    details: [],
  };
  if (!existsSync(STATE_DIR)) return result;

  // gather all slips across weekly state files, grouped by ship date
  const byDate = new Map<string, Slip[]>();
  const weekByDate = new Map<string, string>();
  for (const f of readdirSync(STATE_DIR).filter((f) => /^week-.*\.json$/.test(f))) {
    try {
      const j = JSON.parse(readFileSync(`${STATE_DIR}/${f}`, "utf8"));
      for (const s of j.slips || []) {
        if (!s.shipDate) continue;
        if (opts.from && s.shipDate < opts.from) continue;
        if (opts.to && s.shipDate > opts.to) continue;
        // dedupe same stop/day (multi-page slips, OCR repeats)
        const arr = byDate.get(s.shipDate) || [];
        const norm = String(s.shipToName).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (arr.some((x) => x.shipToName.toLowerCase().replace(/[^a-z0-9]/g, "") === norm)) continue;
        arr.push(s);
        byDate.set(s.shipDate, arr);
        weekByDate.set(s.shipDate, j.builtInvoiceNumber || j.week || "");
      }
    } catch {
      /* skip unreadable state file */
    }
  }

  for (const date of [...byDate.keys()].sort()) {
    result.daysScanned++;
    if (await dayHasTrips(date)) {
      result.daysSkipped++;
      result.details.push({ date, status: "skipped (already tracked)" });
      continue;
    }

    const legs = await buildDayTrips(byDate.get(date)!);
    if (!legs.length) {
      result.details.push({ date, status: "no routable stops" });
      continue;
    }

    const ref = weekByDate.get(date) || "";
    let clock = new Date(`${date}T08:00:00`);
    const rows = legs.map((leg) => {
      const startDate = new Date(clock);
      clock = new Date(clock.getTime() + 30 * 60000);
      const miles = Math.round(leg.miles * 10) / 10;
      const milesValue = Math.round(miles * IRS_BUSINESS_RATE * 100) / 100;
      return {
        startDate,
        endDate: clock,
        category: "Business",
        purpose: "Delivery (Buckeye)",
        startAddr: leg.startAddr,
        stopAddr: leg.stopAddr,
        rate: IRS_BUSINESS_RATE,
        miles,
        milesValue,
        parking: 0,
        tolls: 0,
        total: milesValue,
        vehicle: "Ridgeline",
        notes: ref ? `Auto-logged from ${ref}` : "Auto-logged delivery",
        year: startDate.getFullYear(),
        dedupeKey: `${startDate.toISOString()}|${leg.stopAddr}|${miles}`,
      };
    });

    const dayMiles = Math.round(rows.reduce((s, r) => s + r.miles, 0) * 10) / 10;
    if (!opts.dryRun) {
      const ins = await prisma.mileageTrip.createMany({ data: rows, skipDuplicates: true });
      result.tripsInserted += ins.count;
    } else {
      result.tripsInserted += rows.length;
    }
    result.daysGapFilled++;
    result.details.push({ date, status: opts.dryRun ? "would log" : "logged", trips: rows.length, miles: dayMiles });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Wayne Clark / Aramsco — per-mile delivery client.
// Pickup = 14805 W 99th St, Lenexa KS. Billed $2/mi early 2026, $3/mi from
// ~April. The BILLED miles are the delivery legs (pickup->drops); for the IRS
// log we add the home<->pickup round-trip legs. Source = Wayne invoices in the
// DB (line items = per-drop miles; older invoices store only a total).
//
// Wayne's invoices are issued DAYS AFTER the drive that MileIQ already logged,
// so we skip any delivery whose Lenexa pickup already appears within ±4 days
// (pickupTrackedNear) — that's how we avoid double-counting the GPS record.
const WAYNE_PICKUP = "14805 W 99th St, Lenexa, KS 66215";
const WAYNE_RATE_CHANGE = "2026-04-01"; // $2/mi before, $3/mi on/after

export async function syncWayneMileage(
  opts: { from?: string; to?: string; dryRun?: boolean } = {}
): Promise<SyncResult> {
  const result: SyncResult = {
    daysScanned: 0,
    daysGapFilled: 0,
    daysSkipped: 0,
    tripsInserted: 0,
    details: [],
  };

  const contact = await prisma.accountContact.findFirst({
    where: { name: { contains: "Wayne", mode: "insensitive" } },
  });
  if (!contact) return result;

  const invoices = await prisma.invoice.findMany({
    where: {
      contactId: contact.id,
      issueDate: {
        gte: new Date(`${opts.from || "2026-01-01"}T00:00:00`),
        lte: new Date(`${opts.to || "2026-12-31"}T23:59:59`),
      },
    },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    orderBy: { issueDate: "asc" },
  });

  const homePickupMi = await drive(HOME, WAYNE_PICKUP); // constant outbound

  for (const inv of invoices) {
    if (!inv.issueDate) continue;
    const date = inv.issueDate.toISOString().slice(0, 10);
    result.daysScanned++;

    // derive per-drop legs from billed miles (per-mile lines only: $2-$3/mi)
    const rate = date < WAYNE_RATE_CHANGE ? 2 : 3;
    let drops = inv.lineItems
      .filter((li) => li.unitAmount >= 1.5 && li.unitAmount <= 3.5 && li.quantity > 0)
      .map((li) => ({ label: li.description.trim(), miles: li.quantity, geocodable: /\d/.test(li.description) }));
    if (!drops.length && inv.lineItems.length > 0) {
      // has line items but none are per-mile (e.g. a flat $28 line) — can't derive miles
      result.details.push({ date, status: `skipped ${inv.invoiceNumber} (non-mileage line — needs manual)` });
      continue;
    }
    if (!drops.length && inv.total > 0) {
      // older invoice: only a total -> single delivery leg of total/rate miles
      drops = [{ label: `Wayne delivery (per ${inv.invoiceNumber})`, miles: Math.round((inv.total / rate) * 10) / 10, geocodable: false }];
    }
    if (!drops.length) {
      result.details.push({ date, status: `skipped ${inv.invoiceNumber} (no billable miles)` });
      continue;
    }

    // skip if MileIQ (or a prior sync) already has this Lenexa run nearby
    if (await pickupTrackedNear(date, "14805 W 99th", 4)) {
      result.daysSkipped++;
      result.details.push({ date, status: `skipped ${inv.invoiceNumber} (already tracked ±4d)` });
      continue;
    }

    // build round trip: HOME -> PICKUP -> drops (billed legs) -> HOME
    const legs: LegResult[] = [];
    if (homePickupMi > 0) legs.push({ startAddr: HOME, stopAddr: WAYNE_PICKUP, miles: homePickupMi });
    let prev = WAYNE_PICKUP;
    for (const d of drops) {
      legs.push({ startAddr: prev, stopAddr: d.label, miles: d.miles });
      prev = d.label;
    }
    // return leg: last drop -> home. Only geocode address-like labels; clamp out
    // bad geocodes (a business name can resolve to an out-of-state HQ). Wayne's
    // routes are all KC-metro, so anything >150mi is a geocode error -> fall back.
    const lastDrop = drops[drops.length - 1];
    let backMi = lastDrop.geocodable ? await drive(prev, HOME) : 0;
    if (backMi <= 0 || backMi > 150) backMi = homePickupMi || lastDrop.miles;
    if (backMi > 0) legs.push({ startAddr: prev, stopAddr: HOME, miles: backMi });

    let clock = new Date(`${date}T08:00:00`);
    const rows = legs.map((leg) => {
      const startDate = new Date(clock);
      clock = new Date(clock.getTime() + 30 * 60000);
      const miles = Math.round(leg.miles * 10) / 10;
      const milesValue = Math.round(miles * IRS_BUSINESS_RATE * 100) / 100;
      return {
        startDate,
        endDate: clock,
        category: "Business",
        purpose: "Delivery (Wayne/Aramsco)",
        startAddr: leg.startAddr,
        stopAddr: leg.stopAddr,
        rate: IRS_BUSINESS_RATE,
        miles,
        milesValue,
        parking: 0,
        tolls: 0,
        total: milesValue,
        vehicle: "Ridgeline",
        notes: `Auto-logged from ${inv.invoiceNumber}`,
        year: startDate.getFullYear(),
        dedupeKey: `${startDate.toISOString()}|${leg.stopAddr}|${miles}`,
      };
    });

    const dayMiles = Math.round(rows.reduce((s, r) => s + r.miles, 0) * 10) / 10;
    if (!opts.dryRun) {
      const ins = await prisma.mileageTrip.createMany({ data: rows, skipDuplicates: true });
      result.tripsInserted += ins.count;
    } else {
      result.tripsInserted += rows.length;
    }
    result.daysGapFilled++;
    result.details.push({
      date,
      status: `${opts.dryRun ? "would log" : "logged"} ${inv.invoiceNumber}`,
      trips: rows.length,
      miles: dayMiles,
    });
  }

  return result;
}
