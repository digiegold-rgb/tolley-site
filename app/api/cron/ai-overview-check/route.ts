/**
 * GET/POST /api/cron/ai-overview-check — Daily AI Overview citation snapshot.
 *
 * Schedule: 08:00 UTC daily.
 *
 * For each TRACKED_AI_QUERIES entry, query google with `no_cache=false` and
 * look for the `ai_overview` block. Record citation state.
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { serpapiCall, serpapiKey } from "@/lib/serpapi";
import {
  TRACKED_AI_QUERIES,
  isTolleyDomain,
  extractCitedDomains,
  extractOverviewText,
  type AiOverviewBlock,
} from "@/lib/serpapi/ai-overview-config";

export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const sync = req.headers.get("x-sync-secret");
  if (sync && sync === process.env.SYNC_SECRET) return true;
  return false;
}

async function checkOne(keyword: string, selfDomain?: string) {
  const result = await serpapiCall<{ ai_overview?: AiOverviewBlock }>({
    engine: "google",
    integration: "ai-overview-check",
    params: { q: keyword, hl: "en", gl: "us", num: "10" },
    timeoutMs: 12000,
  });
  if (!result.ok) return;

  const block = result.data?.ai_overview;
  const hasOverview = !!block;
  const cited = extractCitedDomains(block);
  const tolleyCited = cited.some((d) => isTolleyDomain(d, selfDomain));
  const competitorCount = cited.filter(
    (d) => !isTolleyDomain(d, selfDomain)
  ).length;
  const text = extractOverviewText(block);

  await prisma.aiOverviewCheck.create({
    data: {
      keyword,
      hasOverview,
      tolleyCited,
      citedDomains: cited,
      competitorCount,
      overviewText: text || null,
    },
  });
}

async function runCheck() {
  for (const q of TRACKED_AI_QUERIES) {
    try {
      await checkOne(q.keyword, q.selfDomain);
    } catch (err) {
      console.error("[ai-overview-check]", q.keyword, err);
    }
  }
}

async function handler(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!serpapiKey()) {
    return NextResponse.json({ skipped: true }, { status: 200 });
  }

  after(async () => {
    try {
      await runCheck();
      console.log("[ai-overview-check] done");
    } catch (err) {
      console.error("[ai-overview-check] failed", err);
    }
  });

  return NextResponse.json({
    scheduled: true,
    queries: TRACKED_AI_QUERIES.length,
  });
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
