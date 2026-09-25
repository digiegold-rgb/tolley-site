import { NextResponse } from "next/server";
import { checkDiscoveryHealth } from "@/lib/discovery-health";
import { secretEquals } from "@/lib/secret-compare";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || !secretEquals(req.headers.get("authorization"), `Bearer ${process.env.CRON_SECRET}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const results = await checkDiscoveryHealth();
  const failed = results.filter(r => !r.ok).length;
  await prisma.siteEvent.create({ data: { site: "discovery", path: "/services", event: "discovery_health", meta: { checkedAt: new Date().toISOString(), failed, results } } });
  return NextResponse.json({ ok: failed === 0, failed, results }, { status: failed ? 503 : 200 });
}
