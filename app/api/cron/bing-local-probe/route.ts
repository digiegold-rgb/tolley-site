/**
 * GET/POST /api/cron/bing-local-probe — monthly Bing top-10 snapshot for the
 * local "find someone" queries (7th, 08:30 UTC). ChatGPT search answers from
 * Bing's index, so this is the cheapest signal for "would an assistant find us".
 *
 * Rows land in AiOverviewCheck with keyword "bing:<query>":
 *   tolleyCited   = tolley.io in the organic top 10
 *   citedDomains  = the top-10 hostnames in rank order
 *   overviewText  = "#<rank> <url>" when found
 * First time a query goes from unfound → found, Jared gets a Telegram ping.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serpapiCall, serpapiKey } from "@/lib/serpapi";
import { BING_LOCAL_QUERIES, isTolleyDomain } from "@/lib/serpapi/ai-overview-config";
import { notifyTelegram } from "@/lib/budget/notify";

export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth && process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const sync = req.headers.get("x-sync-secret");
  return !!(sync && process.env.SYNC_SECRET && sync === process.env.SYNC_SECRET);
}

type BingResult = { organic_results?: Array<{ position?: number; link?: string; title?: string }> };

async function probeOne(keyword: string): Promise<"recorded" | string> {
  const key = `bing:${keyword}`;
  const result = await serpapiCall<BingResult>({
    engine: "bing",
    integration: "bing-local-probe",
    params: { q: keyword, cc: "US", location: "Kansas City, Missouri, United States", count: "10" },
    timeoutMs: 12000,
  });
  if (!result.ok) return result.budgetBlocked ? "budget" : (result.error || "serpapi error").slice(0, 80);
  const organic = (result.data?.organic_results ?? []).slice(0, 10);
  const hosts = organic.map(r => { try { return new URL(r.link || "").hostname.toLowerCase(); } catch { return ""; } });
  const idx = hosts.findIndex(h => h && isTolleyDomain(h));
  const cited = idx >= 0;
  const previous = await prisma.aiOverviewCheck.findFirst({ where: { keyword: key }, orderBy: { createdAt: "desc" }, select: { tolleyCited: true } });
  await prisma.aiOverviewCheck.create({
    data: {
      keyword: key,
      hasOverview: false,
      tolleyCited: cited,
      citedDomains: hosts.filter(Boolean),
      competitorCount: hosts.filter(h => h && !isTolleyDomain(h)).length,
      overviewText: cited ? `#${organic[idx].position ?? idx + 1} ${organic[idx].link ?? ""}` : null,
    },
  });
  if (cited && !previous?.tolleyCited) {
    await notifyTelegram(`🔎 Bing top-10 for "${keyword}": tolley.io is #${organic[idx].position ?? idx + 1} (${organic[idx].link}). ChatGPT search reads this index.`).catch(() => {});
  }
  return "recorded";
}

async function handler(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!serpapiKey()) return NextResponse.json({ skipped: true });
  // Inline rather than after(), so the cron response carries what actually
  // landed (after() gave no way to report budget-blocked queries).
  const recorded: string[] = [], skipped: Record<string, string> = {};
  // Two at a time: four overshot the monthly cap by three on 9/25 (each
  // concurrent call read the same usage count), and 12 queries at ~4 s each
  // still finish in ~25 s.
  for (let i = 0; i < BING_LOCAL_QUERIES.length; i += 2) {
    await Promise.all(BING_LOCAL_QUERIES.slice(i, i + 2).map(async q => {
      try { const r = await probeOne(q.keyword); if (r === "recorded") recorded.push(q.keyword); else skipped[q.keyword] = r; }
      catch (err) { skipped[q.keyword] = err instanceof Error ? err.message.slice(0, 80) : "error"; console.error("[bing-local-probe]", q.keyword, err); }
    }));
  }
  // "recorded" means a row landed; a budget-blocked query is reported, never counted.
  return NextResponse.json({ ok: Object.keys(skipped).length === 0, queries: BING_LOCAL_QUERIES.length, recorded: recorded.length, skipped });
}
export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }
