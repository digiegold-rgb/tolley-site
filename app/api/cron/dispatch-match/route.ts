import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron: every 2 minutes — process pending orders → match drivers
 */
export async function GET(request: Request) {
  // Verify cron secret (Vercel sets this automatically)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.VERCEL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const syncSecret = process.env.SYNC_SECRET;
    if (!syncSecret) {
      return NextResponse.json({ error: "SYNC_SECRET not configured" }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.tolley.io";
    const res = await fetch(`${baseUrl}/api/dispatch/match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${syncSecret}`,
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(50000),
    });

    const data = await res.json();
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    console.error("[cron/dispatch-match]", err);
    return NextResponse.json({ error: "Match cron failed" }, { status: 500 });
  }
}
