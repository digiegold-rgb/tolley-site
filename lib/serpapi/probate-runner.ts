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

interface OrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
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
  const result = await serpapiCall<{ organic_results?: OrganicResult[] }>({
    engine: "google",
    integration: "probate-scan",
    params: {
      q: buildObitQuery(target),
      num: "10",
      tbs: "qdr:w", // last 7 days
      hl: "en",
      gl: "us",
    },
    timeoutMs: 15000,
  });

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
  for (const target of OBIT_TARGETS) {
    try {
      const r = await scanTarget(target);
      totals.scanned += r.scanned;
      totals.newSignals += r.newSignals;
      totals.duplicates += r.duplicates;
    } catch (err) {
      console.error("[probate-scan]", target.site, target.region, err);
    }
  }
  return totals;
}

interface KnowledgeGraphPerson {
  link?: string;
  source?: string;
  title?: string;
  snippet?: string;
}

const SURVIVED_RX =
  /survived by[^.]*?\b(?:his|her|their)?\s*(wife|husband|son|sons|daughter|daughters|children|brother|sister|mother|father|grandchildren)?[^.]*?([A-Z][a-zA-Z'.\- ]{2,40}(?:\s+[A-Z][a-zA-Z'.\- ]{2,40}){1,2})/i;

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
  for (const item of items) {
    const snippet = `${item.title ?? ""} ${item.snippet ?? ""}`;
    const m = snippet.match(SURVIVED_RX);
    if (m && m[2]) {
      const name = m[2].trim();
      if (name.toLowerCase() !== decedentName.toLowerCase()) {
        heirs.push({
          name,
          relationship: m[1] ?? null,
          source: typeof item.link === "string" ? item.link : "unknown",
        });
      }
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
    const result = await serpapiCall<{ organic_results?: KnowledgeGraphPerson[] }>({
      engine: "google",
      integration: "probate-enrich",
      params: { q, num: "5", hl: "en", gl: "us" },
      timeoutMs: 12000,
    });
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
    const q = buildAddressQuery(signal.decedentName, signal.city, signal.state);
    const result = await serpapiCall<{ organic_results?: KnowledgeGraphPerson[] }>({
      engine: "google",
      integration: "probate-address",
      params: { q, num: "5", hl: "en", gl: "us" },
      timeoutMs: 12000,
    });
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
  for (const r of recent) {
    try {
      const ok = await enrichProbateSignal(r.id);
      if (ok) enriched += 1;
    } catch (err) {
      console.error("[probate-enrich]", r.id, err);
    }
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
  for (const r of rows) {
    try {
      const ok = await enrichProbateSignal(r.id);
      if (ok) resolved += 1;
    } catch (err) {
      console.error("[probate-address-backfill]", r.id, err);
    }
  }
  return { processed: rows.length, resolved };
}
