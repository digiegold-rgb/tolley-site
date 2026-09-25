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
import { NextRequest, NextResponse, after } from "next/server";
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

async function probeOne(keyword: string): Promise<void> {
  const key = `bing:${keyword}`;
  const result = await serpapiCall<BingResult>({
    engine: "bing",
    integration: "bing-local-probe",
    params: { q: keyword, cc: "US", location: "Kansas City, Missouri, United States", count: "10" },
    timeoutMs: 12000,
  });
  if (!result.ok) return;
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
}

async function handler(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!serpapiKey()) return NextResponse.json({ skipped: true });
  after(async () => {
    // Four at a time: 12 sequential SerpAPI calls at 5–12 s each overran the
    // 60 s function budget on the first run (6 of 12 recorded, 2026-09-25).
    for (let i = 0; i < BING_LOCAL_QUERIES.length; i += 4) {
      await Promise.all(BING_LOCAL_QUERIES.slice(i, i + 4).map(async q => {
        try { await probeOne(q.keyword); } catch (err) { console.error("[bing-local-probe]", q.keyword, err); }
      }));
    }
    console.log("[bing-local-probe] done");
  });
  return NextResponse.json({ scheduled: true, queries: BING_LOCAL_QUERIES.length });
}
export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }
