import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  listCampaigns,
  getAccountOverview,
  getDailyAccountMetrics,
  getKeywordPerformance,
} from "@/lib/google-ads";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Math.min(
    Number(req.nextUrl.searchParams.get("days")) || 30,
    90,
  );

  try {
    const [overview, campaigns, daily] = await Promise.all([
      getAccountOverview(days),
      listCampaigns(days),
      getDailyAccountMetrics(days),
    ]);
    const billing = null;

    // Get keywords for top campaign by spend
    const topCampaign = campaigns.sort((a, b) => b.cost - a.cost)[0];
    let keywords: Awaited<ReturnType<typeof getKeywordPerformance>> = [];
    if (topCampaign) {
      try {
        keywords = await getKeywordPerformance(topCampaign.id, days);
      } catch {
        // keyword data may not be available
      }
    }

    return NextResponse.json({ overview, campaigns, daily, keywords, billing });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Google Ads API error";
    const isTokenError = message.includes("DEVELOPER_TOKEN_NOT_APPROVED");
    return NextResponse.json(
      {
        error: isTokenError
          ? "Developer token needs Basic access approval. Apply at Google Ads → Tools → API Center."
          : message,
        code: isTokenError ? "TOKEN_NOT_APPROVED" : "API_ERROR",
      },
      { status: 502 },
    );
  }
}
