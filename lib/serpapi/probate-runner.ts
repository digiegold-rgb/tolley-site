import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serpapiCall } from "@/lib/serpapi";
import {
  OBIT_TARGETS,
  parseObitResult,
  buildObitQuery,
  buildAddressQuery,
  extractStreetAddress,
  type ObitTarget,
} from "@/lib/serpapi/probate-config";
import { parseSurvivedBy } from "@/lib/leads/heir-name";

interface OrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pause between consecutive SerpAPI calls in a burst. */
const THROTTLE_MS = 1200;
/** Back-off before the single retry on a transport-level failure. */
const RETRY_BACKOFF_MS = 1500;

/**
 * One SerpAPI call with a single retry on transport failure.
 *
 * The probate scanners ran at 79–88% success while the distress scanner —
 * same engine, same targets shape — ran at 95%, and the only difference was
 * that distress throttled and retried from day one. Probate fired every
 * target back-to-back with no gap, so timeouts and rate-limit rejections got
 * logged as hard failures. Note these were never billed (SerpAPI charges only
 * successful searches) but they cost real leads: a failed obituary scan is a
 * day of that source's listings never seen.
 *
 * Quota exhaustion and local budget blocks are NOT retried — retrying a
 * definite "no" just wastes wall-clock inside a cron.
 */
async function callWithRetry<T>(
  integration: string,
  params: Record<string, string>,
  timeoutMs: number
) {
  let result = await serpapiCall<T>({
    engine: "google",
    integration,
    params,
    timeoutMs,
  });

  if (!result.ok && !result.outOfQuota && !result.budgetBlocked) {
    await sleep(RETRY_BACKOFF_MS);
    result = await serpapiCall<T>({
      engine: "google",
      integration,
      params,
      timeoutMs,
    });
  }

  return result;
}

interface DiscoverySummary {
  scanned: number;
  newSignals: number;
  duplicates: number;
}

/**
 * Scan one obituary source for recent listings. Returns the count of new
 * ProbateSignal rows created.
 */
async function scanTarget(target: ObitTarget): Promise<DiscoverySummary> {
  const result = await callWithRetry<{ organic_results?: OrganicResult[] }>(
    "probate-scan",
    {
      q: buildObitQuery(target),
      num: "10",
      tbs: "qdr:w", // last 7 days
      hl: "en",
      gl: "us",
    },
    15000
  );

  if (!result.ok || !result.data) {
    return { scanned: 0, newSignals: 0, duplicates: 0 };
  }

  const organic = Array.isArray(result.data.organic_results)
    ? result.data.organic_results
    : [];

  let newSignals = 0;
  let duplicates = 0;

  for (const item of organic) {
    const parsed = parseObitResult(item);
    if (!parsed) continue;

    try {
      await prisma.probateSignal.create({
        data: {
          source: target.site,
          sourceUrl: parsed.url,
          decedentName: parsed.decedentName,
          decedentAge: parsed.decedentAge,
          obitDate: parsed.obitDate,
          city: target.region.split(",")[0]?.trim() || null,
          state: target.state,
          county: target.county,
          status: "discovered",
        },
      });
      newSignals += 1;
    } catch (err) {
      // Unique constraint on (source, sourceUrl) — duplicate hit
      if (err instanceof Error && err.message.includes("Unique")) {
        duplicates += 1;
      }
    }
  }

  return { scanned: organic.length, newSignals, duplicates };
}

export async function runProbateDiscovery() {
  const totals = { scanned: 0, newSignals: 0, duplicates: 0 };
  for (let i = 0; i < OBIT_TARGETS.length; i += 1) {
    const target = OBIT_TARGETS[i];
    try {
      const r = await scanTarget(target);
      totals.scanned += r.scanned;
      totals.newSignals += r.newSignals;
      totals.duplicates += r.duplicates;
    } catch (err) {
      console.error("[probate-scan]", target.site, target.region, err);
    }
    // Space the burst out. Six site-restricted queries fired back-to-back is
    // what tripped rate-limiting/captcha and dragged this scanner to 84%.
    if (i < OBIT_TARGETS.length - 1) await sleep(THROTTLE_MS);
  }
  return totals;
}

interface KnowledgeGraphPerson {
  link?: string;
  source?: string;
  title?: string;
  snippet?: string;
}

// Type alias (not interface) so the array satisfies Prisma's InputJsonValue.
type Heir = {
  name: string;
  relationship: string | null;
  source: string;
};

function extractHeirs(
  items: KnowledgeGraphPerson[],
  decedentName: string
): Heir[] {
  const heirs: Heir[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const snippet = `${item.title ?? ""} ${item.snippet ?? ""}`;
    for (const parsed of parseSurvivedBy(snippet, decedentName)) {
      const key = parsed.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      heirs.push({
        name: parsed.name,
        relationship: parsed.relationship,
        source: typeof item.link === "string" ? item.link : "unknown",
      });
    }
  }
  return heirs.slice(0, 5);
}

function addressFromResults(
  items: KnowledgeGraphPerson[],
  city: string | null,
  state: string | null
): string | null {
  for (const item of items) {
    const text = `${item.title ?? ""} ${item.snippet ?? ""}`;
    const addr = extractStreetAddress(text, city, state);
    if (addr) return addr;
  }
  return null;
}

/**
 * Enrich one ProbateSignal with (a) heir candidates and (b) a matched street
 * address. Populates heirsJson AND matchedAddress — the latter is the field
 * the signal→dossier bridge requires, and which no code path wrote before, so
 * the entire probate backlog was starved.
 *
 * Cost is bounded to at most two SerpAPI queries per signal:
 *   1. heir query ("<name> survived by <city> <state>") — only if not yet enriched
 *   2. address query (people-search sites) — only if we still lack an address
 *      after checking the heir-query snippets for free.
 * Signals that already have both heirsJson and matchedAddress are skipped, so a
 * later address-only backfill costs one query per row, not two.
 */
export async function enrichProbateSignal(signalId: string): Promise<boolean> {
  const signal = await prisma.probateSignal.findUnique({
    where: { id: signalId },
    select: {
      id: true,
      decedentName: true,
      city: true,
      state: true,
      heirsJson: true,
      matchedAddress: true,
      status: true,
    },
  });
  if (!signal || signal.status === "promoted" || signal.status === "dismissed") {
    return false;
  }

  const needHeirs = signal.heirsJson == null;
  const needAddress = !signal.matchedAddress;
  if (!needHeirs && !needAddress) return false; // fully enriched already

  const data: Prisma.ProbateSignalUpdateInput = {};
  let heirs: Heir[] = [];
  let matchedAddress: string | null = null;
  let queries = 0;

  // 1. Heir query — also mined for a free address before we spend a 2nd query.
  if (needHeirs) {
    const q = `"${signal.decedentName}" survived by ${signal.city ?? ""} ${signal.state ?? ""}`.trim();
    const result = await callWithRetry<{ organic_results?: KnowledgeGraphPerson[] }>(
      "probate-enrich",
      { q, num: "5", hl: "en", gl: "us" },
      12000
    );
    queries += 1;
    if (result.ok && result.data) {
      const items = Array.isArray(result.data.organic_results)
        ? result.data.organic_results
        : [];
      heirs = extractHeirs(items, signal.decedentName);
      data.heirsJson = heirs;
      if (needAddress) {
        matchedAddress = addressFromResults(items, signal.city, signal.state);
      }
    }
  }

  // 2. Dedicated address query — only if we still have no address.
  if (needAddress && !matchedAddress) {
    // Second call for the same signal — space it from the heir query above.
    if (queries > 0) await sleep(THROTTLE_MS);
    const q = buildAddressQuery(signal.decedentName, signal.city, signal.state);
    const result = await callWithRetry<{ organic_results?: KnowledgeGraphPerson[] }>(
      "probate-address",
      { q, num: "5", hl: "en", gl: "us" },
      12000
    );
    queries += 1;
    if (result.ok && result.data) {
      const items = Array.isArray(result.data.organic_results)
        ? result.data.organic_results
        : [];
      matchedAddress = addressFromResults(items, signal.city, signal.state);
    }
  }

  if (matchedAddress) data.matchedAddress = matchedAddress;
  // Promote to "enriched" once we have heirs and/or an address.
  if (heirs.length > 0 || matchedAddress) data.status = "enriched";
  if (queries > 0) data.serpapiHits = { increment: queries };

  if (Object.keys(data).length === 0) return false;
  await prisma.probateSignal.update({ where: { id: signalId }, data });
  return heirs.length > 0 || matchedAddress != null;
}

export async function enrichRecentDiscovered(limit: number = 6) {
  const recent = await prisma.probateSignal.findMany({
    where: { status: "discovered", heirsJson: { equals: Prisma.AnyNull } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true },
  });
  let enriched = 0;
  for (let i = 0; i < recent.length; i += 1) {
    const r = recent[i];
    try {
      const ok = await enrichProbateSignal(r.id);
      if (ok) enriched += 1;
    } catch (err) {
      console.error("[probate-enrich]", r.id, err);
    }
    if (i < recent.length - 1) await sleep(THROTTLE_MS);
  }
  return { processed: recent.length, enriched };
}

/**
 * Address-only backfill for the historical rows that were "enriched" (or
 * discovered) before matchedAddress resolution existed. One SerpAPI query per
 * row (the address query), so this is quota-sensitive — call with a small
 * limit and only when the SerpAPI budget allows. Not wired into any cron.
 */
export async function backfillMatchedAddresses(limit: number = 10) {
  const rows = await prisma.probateSignal.findMany({
    where: {
      status: { in: ["discovered", "enriched"] },
      matchedAddress: null,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true },
  });
  let resolved = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    try {
      const ok = await enrichProbateSignal(r.id);
      if (ok) resolved += 1;
    } catch (err) {
      console.error("[probate-address-backfill]", r.id, err);
    }
    if (i < rows.length - 1) await sleep(THROTTLE_MS);
  }
  return { processed: rows.length, resolved };
}
