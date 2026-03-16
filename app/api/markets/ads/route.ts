import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  listCampaigns,
  getAccountOverview,
  getDailyAccountMetrics,
  updateCampaignBudget,
  updateCampaignStatus,
} from "@/lib/google-ads";

export const runtime = "nodejs";

/**
 * GET /api/markets/ads — Account overview + campaigns + daily metrics
 * Query: days (7|30|90)
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
  } catch (error: any) {
    console.error("[ads] GET error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch ads data", detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/markets/ads — Campaign actions (pause/enable, budget update)
 * Body: { action, campaignId, budgetId, value }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action, campaignId, budgetId, value } = body;

  try {
    if (action === "status") {
      await updateCampaignStatus(campaignId, value as "ENABLED" | "PAUSED");
      return NextResponse.json({ ok: true, message: `Campaign ${value.toLowerCase()}` });
    }

    if (action === "budget") {
      const micros = Math.round(parseFloat(value) * 1_000_000);
      await updateCampaignBudget(budgetId, micros);
      return NextResponse.json({ ok: true, message: `Budget updated to $${value}` });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("[ads] POST error:", error.message);
    return NextResponse.json(
      { error: "Action failed", detail: error.message },
      { status: 500 }
    );
  }
}
