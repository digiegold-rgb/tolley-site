import { prisma } from "@/lib/prisma";
import { serpapiCall } from "@/lib/serpapi";
import {
  DISTRESS_TARGETS,
  parseDistressResult,
  isRelevant,
  type DistressTarget,
  type OrganicResult,
} from "@/lib/serpapi/distress-config";

export interface NewDistressSignal {
  id: string;
  kind: string;
  title: string;
  sourceUrl: string | null;
  addressGuess: string | null;
  ownerGuess: string | null;
  city: string | null;
}

export interface DistressDiscovery {
  scanned: number;
  newSignals: number;
  duplicates: number;
  failures: number;
  created: NewDistressSignal[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Best-effort hostname for the source tag + (source, sourceUrl) unique key. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/**
 * Scan one distress target. Retries once on transport failure/timeout before
 * giving up (the probate scanner's biggest source of "failures" was tight,
 * un-retried bursts against the 200/hr cap — fixed here from the start).
 */
async function scanTarget(target: DistressTarget): Promise<{
  scanned: number;
  newSignals: number;
  duplicates: number;
  failed: boolean;
  created: NewDistressSignal[];
}> {
  let result = await serpapiCall<{ organic_results?: OrganicResult[] }>({
    engine: "google",
    integration: "distress-scan",
    params: {
      q: target.q,
      num: "10",
      tbs: target.freshness,
      hl: "en",
      gl: "us",
    },
    timeoutMs: 18000,
  });

  if (!result.ok && !result.outOfQuota) {
    await sleep(1500); // back off, then one retry
    result = await serpapiCall<{ organic_results?: OrganicResult[] }>({
      engine: "google",
      integration: "distress-scan",
      params: { q: target.q, num: "10", tbs: target.freshness, hl: "en", gl: "us" },
      timeoutMs: 18000,
    });
  }

  if (!result.ok || !result.data) {
    return { scanned: 0, newSignals: 0, duplicates: 0, failed: true, created: [] };
  }

  const organic = Array.isArray(result.data.organic_results)
    ? result.data.organic_results
    : [];

  let newSignals = 0;
  let duplicates = 0;
  const created: NewDistressSignal[] = [];

  for (const item of organic) {
    const parsed = parseDistressResult(item);
    if (!parsed) continue;

    // Drop junk domains + anything not clearly KC-metro before it ever
    // becomes a row (so the weekly push stays high-signal).
    if (!isRelevant(parsed.url, parsed.title, parsed.snippet)) continue;

    const host = hostOf(parsed.url);
    try {
      const row = await prisma.distressSignal.create({
        data: {
          kind: target.kind,
          source: host,
          sourceUrl: parsed.url,
          title: parsed.title.slice(0, 500),
          snippet: parsed.snippet.slice(0, 1000) || null,
          addressGuess: parsed.addressGuess,
          ownerGuess: parsed.ownerGuess,
          city: target.city,
          county: target.county,
          state: target.state,
          status: "new",
        },
        select: {
          id: true,
          kind: true,
          title: true,
          sourceUrl: true,
          addressGuess: true,
          ownerGuess: true,
          city: true,
        },
      });
      newSignals += 1;
      created.push(row);
    } catch (err) {
      // Unique constraint on (source, sourceUrl) — already seen
      if (err instanceof Error && err.message.includes("Unique")) {
        duplicates += 1;
      }
    }
  }

  return { scanned: organic.length, newSignals, duplicates, failed: false, created };
}

export async function runDistressDiscovery(): Promise<DistressDiscovery> {
  const totals: DistressDiscovery = {
    scanned: 0,
    newSignals: 0,
    duplicates: 0,
    failures: 0,
    created: [],
  };

  for (let i = 0; i < DISTRESS_TARGETS.length; i++) {
    const target = DISTRESS_TARGETS[i];
    try {
      const r = await scanTarget(target);
      totals.scanned += r.scanned;
      totals.newSignals += r.newSignals;
      totals.duplicates += r.duplicates;
      if (r.failed) totals.failures += 1;
      totals.created.push(...r.created);
    } catch (err) {
      totals.failures += 1;
      console.error("[distress-scan]", target.kind, err);
    }
    // Throttle between sources to stay well under the 200/hr cap and avoid
    // the burst-rate-limiting that dinged the probate scanner.
    if (i < DISTRESS_TARGETS.length - 1) await sleep(1200);
  }

  return totals;
}
