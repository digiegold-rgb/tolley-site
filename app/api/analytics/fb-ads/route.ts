import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getAccountOverview,
  listCampaigns,
  getDailyAccountMetrics,
  getAccountBilling,
} from "@/lib/facebook-ads";

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
    const [overview, campaigns, daily, billing] = await Promise.all([
      getAccountOverview(days),
      listCampaigns(days),
      getDailyAccountMetrics(days),
      getAccountBilling(),
    ]);

    return NextResponse.json({ overview, campaigns, daily, billing });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Facebook Ads API error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
