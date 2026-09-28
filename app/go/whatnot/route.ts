import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { REFERRAL_URL } from "@/lib/live/campaign";
import { campaignSource } from "@/lib/live/core";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const target = REFERRAL_URL;
  after(async () => { await prisma.siteEvent.create({ data: { site: "live", path: "/go/whatnot", event: "referral_click", label: campaignSource(req.nextUrl.searchParams.get("utm_source")), meta: { referral: true } } }).catch(() => {}); });
  return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "no-store" } });
}
