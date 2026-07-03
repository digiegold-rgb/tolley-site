import { NextRequest, NextResponse } from "next/server";
import { FB_PAGES, debugToken, getPageToken } from "@/lib/facebook";
import { alertDiscord } from "@/lib/shop/treasure-haul-post";

export const runtime = "nodejs";
export const maxDuration = 60;

const WARN_THRESHOLD_DAYS = 7;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

interface PageHealth {
  pageId: string;
  pageName: string;
  envKey: string;
  ok: boolean;
  expiresAt: number | null;
  daysUntilExpiry: number | null;
  error: string | null;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const results: PageHealth[] = [];
  const alerts: string[] = [];

  for (const page of FB_PAGES) {
    const token = getPageToken(page);
    if (!token) {
      results.push({
        pageId: page.id,
        pageName: page.name,
        envKey: page.tokenEnvKey,
        ok: false,
        expiresAt: null,
        daysUntilExpiry: null,
        error: "token not set",
      });
      alerts.push(`${page.name}: ${page.tokenEnvKey} not set`);
      continue;
    }
    const info = await debugToken(token);
    let daysUntilExpiry: number | null = null;
    if (info.expiresAt && info.expiresAt > 0) {
      daysUntilExpiry = Math.floor((info.expiresAt - now) / 86_400);
    }
    const entry: PageHealth = {
      pageId: page.id,
      pageName: page.name,
      envKey: page.tokenEnvKey,
      ok: info.isValid,
      expiresAt: info.expiresAt ?? null,
      daysUntilExpiry,
      error: info.error ?? null,
    };
    results.push(entry);
    if (!info.isValid) {
      alerts.push(`${page.name}: token invalid — ${info.error || "unknown"}`);
    } else if (daysUntilExpiry !== null && daysUntilExpiry <= WARN_THRESHOLD_DAYS) {
      alerts.push(
        `${page.name}: token expires in ${daysUntilExpiry} day(s). Refresh ${page.tokenEnvKey}.`
      );
    }
  }

  if (alerts.length > 0) {
    await alertDiscord(`token health\n${alerts.map((a) => `• ${a}`).join("\n")}`);
  }

  return NextResponse.json({ ok: true, results, alerts });
}
