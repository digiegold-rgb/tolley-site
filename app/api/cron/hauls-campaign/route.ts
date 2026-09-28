import { NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import { drainCampaign } from "@/lib/live/campaign-publish";
import { syncImpactIfDue } from "@/lib/live/impact";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || !secretEquals(req.headers.get("authorization"), `Bearer ${process.env.CRON_SECRET}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await drainCampaign();
  await syncImpactIfDue();
  return NextResponse.json(result);
}
