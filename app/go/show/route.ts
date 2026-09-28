import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { WHATNOT_PROFILE, campaignSource } from "@/lib/live/core";
import { canPromote } from "@/lib/live/campaign";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("show");
  const show = id ? await prisma.liveShow.findUnique({ where: { id } }).catch(() => null) : null;
  const target = show && canPromote(show) ? show.whatnotUrl : WHATNOT_PROFILE;
  after(async () => { await prisma.siteEvent.create({ data: { site: "live", path: "/go/show", event: "show_click", label: campaignSource(req.nextUrl.searchParams.get("utm_source")), meta: { showId: show?.id || null, campaign: campaignSource(req.nextUrl.searchParams.get("utm_campaign")) } } }).catch(() => {}); });
  return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "no-store" } });
}
