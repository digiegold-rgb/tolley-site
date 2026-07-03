import { NextRequest, NextResponse } from "next/server";
import { runAmazonPicksCycle } from "@/lib/shop/amazon-picks-runner";

export const runtime = "nodejs";
export const maxDuration = 120;

type Platform = "facebook" | "instagram" | "pinterest";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

// Daily fan-out: 3 haul-eligible products to FB + IG + Pinterest. Defaults
// can be overridden with ?platforms=facebook,instagram so we can manually
// retry a single channel without re-posting to the others.
const DEFAULT_PLATFORMS: Platform[] = ["facebook", "instagram", "pinterest"];

function parsePlatforms(raw: string | null): Platform[] | null {
  if (!raw) return null;
  const want = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const valid = want.filter((p): p is Platform =>
    DEFAULT_PLATFORMS.includes(p as Platform),
  );
  return valid.length > 0 ? valid : null;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const override = parsePlatforms(req.nextUrl.searchParams.get("platforms"));
  const platforms = override ?? DEFAULT_PLATFORMS;

  const result = await runAmazonPicksCycle({ platforms, mode: "haul" });

  return NextResponse.json({
    ok: result.ok,
    mode: "amazon_haul",
    picked: result.pickedProducts,
    results: result.results,
  });
}
