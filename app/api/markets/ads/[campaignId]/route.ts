import { NextRequest, NextResponse } from "next/server";
import { getCampaignMetrics, getKeywordPerformance, getAdPerformance } from "@/lib/google-ads";

export const runtime = "nodejs";

/**
 * GET /api/markets/ads/[campaignId] — Campaign detail: daily metrics, keywords, ads
 * Query: days (7|30|90)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30");

  try {
    const [metrics, keywords, ads] = await Promise.all([
      getCampaignMetrics(campaignId, days),
      getKeywordPerformance(campaignId, days),
      getAdPerformance(campaignId, days),
    ]);

    return NextResponse.json({ metrics, keywords, ads });
  } catch (error: any) {
    console.error("[ads] campaign detail error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch campaign data", detail: error.message },
      { status: 500 }
    );
  }
}
