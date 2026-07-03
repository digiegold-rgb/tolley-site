import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serpapiCall } from "@/lib/serpapi";
import {
  OBIT_TARGETS,
  parseObitResult,
  buildObitQuery,
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

/**
 * Enrich one ProbateSignal with heir candidates by querying for
 * "<name> survived by". Stores up to 5 heirs in heirsJson.
 *
 * One enrichment query per signal — caps cost. Skips signals already enriched.
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
      status: true,
    },
  });
  if (!signal || signal.status === "promoted" || signal.status === "dismissed") {
    return false;
  }
  if (signal.heirsJson) return false; // already enriched

  const q = `"${signal.decedentName}" survived by ${signal.city ?? ""} ${signal.state ?? ""}`.trim();
  const result = await serpapiCall<{
    organic_results?: KnowledgeGraphPerson[];
  }>({
    engine: "google",
    integration: "probate-enrich",
    params: { q, num: "5", hl: "en", gl: "us" },
    timeoutMs: 12000,
  });

  if (!result.ok || !result.data) return false;
  const items = Array.isArray(result.data.organic_results)
    ? result.data.organic_results
    : [];

  // Heir extraction — pull names that appear after "survived by" in snippets.
  const heirs: { name: string; relationship: string | null; source: string }[] = [];
  const SURVIVED_RX =
    /survived by[^.]*?\b(?:his|her|their)?\s*(wife|husband|son|sons|daughter|daughters|children|brother|sister|mother|father|grandchildren)?[^.]*?([A-Z][a-zA-Z'.\- ]{2,40}(?:\s+[A-Z][a-zA-Z'.\- ]{2,40}){1,2})/i;

  for (const item of items) {
    const snippet = `${item.title ?? ""} ${item.snippet ?? ""}`;
    const m = snippet.match(SURVIVED_RX);
    if (m && m[2]) {
      const name = m[2].trim();
      if (name.toLowerCase() !== signal.decedentName.toLowerCase()) {
        heirs.push({
          name,
          relationship: m[1] ?? null,
          source: typeof item.link === "string" ? item.link : "unknown",
        });
      }
    }
  }

  await prisma.probateSignal.update({
    where: { id: signalId },
    data: {
      heirsJson: heirs.length > 0 ? heirs.slice(0, 5) : [],
      serpapiHits: { increment: 1 },
      status: heirs.length > 0 ? "enriched" : signal.status,
    },
  });
  return heirs.length > 0;
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
