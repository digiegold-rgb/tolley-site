/**
 * GET /api/cron/indexnow-submit — weekly full-sitemap push to IndexNow (Bing).
 * Schedule: Monday 12:00 UTC (vercel.json). Auth: CRON_SECRET bearer or SYNC_SECRET.
 * `?urls=/cleanouts,/estate` submits only those paths (post-deploy use).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { secretEquals } from "@/lib/secret-compare";
import { indexNowKey, sitemapUrls, submitIndexNow } from "@/lib/indexnow";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth && secretEquals(auth, `Bearer ${process.env.CRON_SECRET}`)) return true;
  const sync = req.headers.get("x-sync-secret");
  return !!(process.env.SYNC_SECRET && sync && secretEquals(sync, process.env.SYNC_SECRET));
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!indexNowKey()) return NextResponse.json({ skipped: true, reason: "INDEXNOW_KEY not set" });
  const only = req.nextUrl.searchParams.get("urls");
  const urls = only ? only.split(",").map(s => s.trim()).filter(Boolean) : await sitemapUrls();
  const result = await submitIndexNow(urls);
  await prisma.siteEvent.create({ data: { site: "discovery", path: "/indexnow", event: "indexnow_submit", meta: { ...result, sample: urls.slice(0, 5), at: new Date().toISOString() } } }).catch(() => {});
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
