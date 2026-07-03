import { NextRequest, NextResponse } from "next/server";
import { runAmazonPicksCycle } from "@/lib/shop/amazon-picks-runner";
import { alertDiscord } from "@/lib/shop/treasure-haul-post";

export const runtime = "nodejs";
export const maxDuration = 120;

type Platform = "facebook" | "instagram" | "pinterest";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (!header) return false;
  return header === `Bearer ${secret}`;
}

const ALL: Platform[] = ["facebook", "instagram", "pinterest"];

/**
 * Pick platforms per day-of-week so a single cron entry covers the full
 * Sun/Tue/Fri rotation without duplicating posts to FB three times a week.
 *   Sun → FB carousel + IG carousel + Pinterest (full storefront highlight)
 *   Tue → IG + Pinterest (mid-week creators-feed push)
 *   Fri → FB + Pinterest (weekend warm-up for Treasure Haul Page followers)
 */
function defaultPlatformsForDay(d: Date): Platform[] {
  const day = d.getUTCDay();
  if (day === 0) return ["facebook", "instagram", "pinterest"];
  if (day === 2) return ["instagram", "pinterest"];
  if (day === 5) return ["facebook", "pinterest"];
  return [];
}

function parsePlatforms(raw: string | null): Platform[] | null {
  if (!raw) return null;
  const want = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const valid = want.filter((p): p is Platform => ALL.includes(p as Platform));
  return valid.length > 0 ? valid : null;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const override = parsePlatforms(req.nextUrl.searchParams.get("platforms"));
  const platforms = override ?? defaultPlatformsForDay(new Date());

  if (platforms.length === 0) {
    return NextResponse.json({
      ok: true,
      mode: "amazon_picks",
      skipped: "no platforms scheduled for today",
    });
  }

  const result = await runAmazonPicksCycle({ platforms });

  const failed = result.results.filter((r) => !r.ok);
  if (failed.length > 0) {
    const summary = failed
      .map((f) => `${f.platform}: ${f.error ?? "?"}`)
      .join(" | ");
    await alertDiscord(`amazon-picks partial failure → ${summary}`);
  }

  return NextResponse.json({
    ok: result.ok,
    mode: "amazon_picks",
    platforms,
    products: result.pickedProducts,
    results: result.results,
  });
}
