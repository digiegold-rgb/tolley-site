/**
 * lib/leads/signal-dossier-bridge.ts
 *
 * The GUARANTEED dossier producer.
 *
 * The only pre-existing automated DossierJob producer — queueAutoDossiers()
 * in lib/scan/leads.ts — depends on the Parcel table, which has never had a
 * row (the regrid chain yields nothing). Meanwhile ProbateSignal (456 rows,
 * fresh) and DistressSignal (34 rows, fresh) accumulate healthily but only
 * ever become GrowthLead outreach drafts, never dossiers. So the Monday
 * digest — which reads scored DossierJobs — has been empty for weeks.
 *
 * This bridge promotes those fresh signals into Listing + queued DossierJob so
 * the dossier pipeline enriches them and they qualify for the digest.
 *
 * Called from the dossier-process cron (every 2 min) ONLY when the queue is
 * empty, capped to ~3 new dossiers/day.
 *
 * Idempotency (no schema migration):
 *   - Each signal maps to a deterministic Listing.mlsId = "signal-<model>-<id>"
 *     (mlsId is @unique → find-or-create is safe).
 *   - Before queueing, we check that listing has no DossierJob yet.
 *   This never double-queues a signal and does NOT mutate signal.status, so it
 *   stays independent of seller-seed's promote lifecycle.
 */

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface SignalBridgeResult {
  created: number;
  dailyCap: number;
  alreadyToday: number;
  details: Array<{
    model: "probate" | "distress";
    signalId: string;
    address: string;
    listingId: string;
    dossierJobId: string;
  }>;
}

const DAILY_CAP = 3;
// requestedBy markers used solely by this bridge — also used to count the
// rolling-24h daily cap so a busy queue can't blow past it.
const BRIDGE_REQUESTED_BY = ["probate-scan", "distress-scan"] as const;

interface Candidate {
  model: "probate" | "distress";
  signalId: string;
  mlsId: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  listPrice: number | null;
  priority: number;
  raw: Prisma.InputJsonObject;
}

async function probateCandidates(limit: number): Promise<Candidate[]> {
  if (limit <= 0) return [];
  // Fetch more than we need — the newest signals may already be bridged, so we
  // walk down until we find `limit` un-bridged ones (filtered by the caller).
  const rows = await prisma.probateSignal.findMany({
    where: {
      status: { in: ["discovered", "enriched"] },
      matchedAddress: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(limit * 10, 30),
  });
  return rows.map((s) => ({
    model: "probate" as const,
    signalId: s.id,
    mlsId: `signal-probate-${s.id}`,
    address: s.matchedAddress!,
    city: s.city,
    state: s.state ?? "MO",
    zip: s.zip,
    listPrice: s.estimatedValue ?? null,
    priority: 4,
    raw: {
      signal: "probate",
      signalId: s.id,
      decedentName: s.decedentName,
      sourceUrl: s.sourceUrl,
      estimatedValue: s.estimatedValue,
    },
  }));
}

async function distressCandidates(limit: number): Promise<Candidate[]> {
  if (limit <= 0) return [];
  const rows = await prisma.distressSignal.findMany({
    where: {
      status: { in: ["new", "reviewed"] },
      addressGuess: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(limit * 10, 30),
  });
  return rows.map((s) => ({
    model: "distress" as const,
    signalId: s.id,
    mlsId: `signal-distress-${s.id}`,
    address: s.addressGuess!,
    city: s.city,
    state: s.state ?? "MO",
    zip: null,
    listPrice: null,
    priority: 4,
    raw: {
      signal: "distress",
      signalId: s.id,
      kind: s.kind,
      title: s.title,
      ownerGuess: s.ownerGuess,
      sourceUrl: s.sourceUrl,
    },
  }));
}

/**
 * Find-or-create the Listing for a signal, then queue a DossierJob if one does
 * not already exist for that listing. Returns the created ids, or null if the
 * signal was already bridged (listing already has a dossier job).
 */
async function bridgeOne(
  c: Candidate,
): Promise<{ listingId: string; dossierJobId: string } | null> {
  const existing = await prisma.listing.findUnique({
    where: { mlsId: c.mlsId },
    select: { id: true, dossierJobs: { select: { id: true }, take: 1 } },
  });

  let listingId: string;
  if (existing) {
    if (existing.dossierJobs.length > 0) return null; // already bridged
    listingId = existing.id;
  } else {
    const listing = await prisma.listing.create({
      data: {
        mlsId: c.mlsId,
        status: "Off-Market",
        address: c.address,
        city: c.city ?? undefined,
        state: c.state ?? "MO",
        zip: c.zip ?? undefined,
        listPrice: c.listPrice ?? undefined,
        source: "signal",
        rawData: c.raw,
      },
      select: { id: true },
    });
    listingId = listing.id;
  }

  const job = await prisma.dossierJob.create({
    data: {
      listingId,
      status: "queued",
      priority: c.priority,
      requestedBy: c.model === "probate" ? "probate-scan" : "distress-scan",
    },
    select: { id: true },
  });

  return { listingId, dossierJobId: job.id };
}

/**
 * Promote up to (DAILY_CAP - already-created-today) fresh signals into queued
 * DossierJobs. Safe to call every cron cycle — the rolling 24h count enforces
 * the cap and the mlsId/dossierJob check enforces idempotency.
 */
export async function runSignalDossierBridge(
  opts?: { dailyCap?: number },
): Promise<SignalBridgeResult> {
  const dailyCap = opts?.dailyCap ?? DAILY_CAP;

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const alreadyToday = await prisma.dossierJob.count({
    where: {
      requestedBy: { in: [...BRIDGE_REQUESTED_BY] },
      createdAt: { gte: dayAgo },
    },
  });

  const result: SignalBridgeResult = {
    created: 0,
    dailyCap,
    alreadyToday,
    details: [],
  };

  const remaining = dailyCap - alreadyToday;
  if (remaining <= 0) return result;

  // Interleave probate first (higher volume + higher intent), then distress.
  const candidates = [
    ...(await probateCandidates(remaining)),
    ...(await distressCandidates(remaining)),
  ];

  for (const c of candidates) {
    if (result.created >= remaining) break;
    try {
      const out = await bridgeOne(c);
      if (!out) continue; // already bridged — walk to the next signal
      result.created++;
      result.details.push({
        model: c.model,
        signalId: c.signalId,
        address: c.address,
        listingId: out.listingId,
        dossierJobId: out.dossierJobId,
      });
    } catch (err) {
      // A unique-race on mlsId means a concurrent cron already bridged it —
      // skip, don't fail the whole run.
      console.error("[signal-dossier-bridge] failed for", c.mlsId, err);
    }
  }

  if (result.created > 0) {
    console.info("[signal-dossier-bridge] queued", {
      created: result.created,
      alreadyToday,
      dailyCap,
    });
  }

  return result;
}
