import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  listCampaigns,
  getAccountOverview,
  getDailyAccountMetrics,
  updateCampaignStatus,
  updateCampaignBudget,
} from "@/lib/facebook-ads";

export const runtime = "nodejs";

/**
 * GET /api/markets/fb-ads — Account overview + campaigns + daily metrics
 * Query: days (7|30|90|max)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30");

  try {
    const [overview, campaigns, dailyMetrics] = await Promise.all([
      getAccountOverview(days),
      listCampaigns(days),
      getDailyAccountMetrics(days),
    ]);

    return NextResponse.json({ overview, campaigns, dailyMetrics });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[fb-ads] GET error:", msg);
    return NextResponse.json(
      { error: "Failed to fetch Facebook Ads data", detail: msg },
      { status: 500 },
    );
  }
}

/**
 * POST /api/markets/fb-ads — Campaign actions (pause/activate, budget update)
 * Body: { action, campaignId, value }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action, campaignId, value } = body;

  try {
    if (action === "status") {
      await updateCampaignStatus(campaignId, value as "ACTIVE" | "PAUSED");
      return NextResponse.json({ ok: true, message: `Campaign ${value.toLowerCase()}` });
    }

    if (action === "budget") {
      const cents = Math.round(parseFloat(value) * 100);
      await updateCampaignBudget(campaignId, cents);
      return NextResponse.json({ ok: true, message: `Budget updated to $${value}` });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[fb-ads] POST error:", msg);
    return NextResponse.json(
      { error: "Action failed", detail: msg },
      { status: 500 },
    );
  }
}
