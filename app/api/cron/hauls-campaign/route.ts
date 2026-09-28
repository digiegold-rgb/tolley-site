import { NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import { drainCampaign } from "@/lib/live/campaign-publish";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || !secretEquals(req.headers.get("authorization"), `Bearer ${process.env.CRON_SECRET}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await drainCampaign());
}
