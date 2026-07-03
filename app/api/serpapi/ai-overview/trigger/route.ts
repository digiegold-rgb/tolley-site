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
import { validateShopAdmin } from "@/lib/shop-auth";

export const maxDuration = 60;

export async function POST(_req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!serpapiKey()) {
    return NextResponse.json({ error: "SERPAPI_KEY missing" }, { status: 503 });
  }

  after(async () => {
    for (const q of TRACKED_AI_QUERIES) {
      try {
        const result = await serpapiCall<{ ai_overview?: AiOverviewBlock }>({
          engine: "google",
          integration: "ai-overview-check",
          params: { q: q.keyword, hl: "en", gl: "us", num: "10" },
          timeoutMs: 12000,
        });
        if (!result.ok) continue;
        const block = result.data?.ai_overview;
        const cited = extractCitedDomains(block);
        await prisma.aiOverviewCheck.create({
          data: {
            keyword: q.keyword,
            hasOverview: !!block,
            tolleyCited: cited.some((d) => isTolleyDomain(d, q.selfDomain)),
            citedDomains: cited,
            competitorCount: cited.filter(
              (d) => !isTolleyDomain(d, q.selfDomain)
            ).length,
            overviewText: extractOverviewText(block) || null,
          },
        });
      } catch (err) {
        console.error("[ai-overview-trigger]", q.keyword, err);
      }
    }
  });

  return NextResponse.json({
    scheduled: true,
    queries: TRACKED_AI_QUERIES.length,
  });
}
