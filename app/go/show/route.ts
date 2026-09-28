import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { WHATNOT_PROFILE, campaignSource } from "@/lib/live/core";
import { canPromote } from "@/lib/live/campaign";
import { isBot } from "@/lib/visit-filters";
import { cachedImpactLink } from "@/lib/live/impact";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("show");
  const show = id ? await prisma.liveShow.findUnique({ where: { id } }).catch(() => null) : null;
  const target = show && canPromote(show) ? show.whatnotUrl : WHATNOT_PROFILE;
  // Affiliate attribution applies only to an intentional click from our real hub.
  // Old social redirect URLs remain direct Whatnot links, preserving the source.
  let fromHub = false;
  try { const ref = new URL(req.headers.get("referer") || ""); fromHub = ref.origin === req.nextUrl.origin && ref.pathname === "/live"; } catch {}
  const affiliate = fromHub && !isBot(req.headers.get("user-agent")) ? await cachedImpactLink(target) : null;
  after(async () => { if (isBot(req.headers.get("user-agent"))) return; await prisma.siteEvent.create({ data: { site: "live", path: "/go/show", event: "show_click", label: campaignSource(req.nextUrl.searchParams.get("utm_source")), meta: { showId: show?.id || null, affiliate: !!affiliate, campaign: campaignSource(req.nextUrl.searchParams.get("utm_campaign")) } } }).catch(() => {}); if(affiliate) await prisma.siteEvent.create({data:{site:"live",path:"/go/show",event:"impact_click",label:campaignSource(req.nextUrl.searchParams.get("utm_source")),meta:{showId:show?.id||null}}}).catch(()=>{}); });
  return NextResponse.redirect(affiliate || target, { status: 302, headers: { "Cache-Control": "no-store" } });
}
