import { prisma } from "@/lib/prisma";
import { campaignSource } from "@/lib/live/core";
import { isBot } from "@/lib/visit-filters";
import { rateLimitByIp } from "@/lib/rate-limit";
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin !== new URL(req.url).origin || isBot(req.headers.get("user-agent"))) return new Response(null, { status: 204 });
  const limited = await rateLimitByIp(req, "hauls-visit", 30, 300);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.source !== "string" || body.source.length > 100) return Response.json({ error: "Invalid source" }, { status: 400 });
  if (body.event !== undefined && body.event !== "impact_click") return Response.json({ error: "Invalid event" }, { status: 400 });
  await prisma.siteEvent.create({ data: { site: "live", path: "/live", event: body.event === "impact_click" ? "impact_click" : "campaign_visit", label: campaignSource(body.source), meta: { campaign: campaignSource(typeof body.campaign === "string" ? body.campaign : null) } } });
  return new Response(null, { status: 204 });
}
