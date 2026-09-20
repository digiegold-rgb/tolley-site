import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { campaignSource, WHATNOT_PROFILE } from "@/lib/live/core";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const settings = await prisma.liveSettings.findUnique({ where: { id: "treasure-hauls" }, select: { referralUrl: true } }).catch(() => null);
  const candidate = settings?.referralUrl;
  const target = candidate && /^https:\/\/(www\.)?whatnot\.com\/invite\/[a-z0-9_]+$/.test(candidate) ? candidate : WHATNOT_PROFILE;
  after(async () => { await prisma.siteEvent.create({ data: { site: "live", path: "/go/whatnot", event: "whatnot_click", label: campaignSource(req.nextUrl.searchParams.get("utm_source")), meta: { referral: target !== WHATNOT_PROFILE } } }).catch(() => {}); });
  return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "no-store" } });
}
