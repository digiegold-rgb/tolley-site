import { hasValidShopAdminCookie } from "@/lib/shop-auth";
import { privateHeaders, sameOrigin } from "@/lib/day/auth";
import { readSnapshot, refreshSnapshot, snapshotKey } from "@/lib/day/store";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  if (!await hasValidShopAdminCookie()) return Response.json({ error: "PIN required" }, { status: 401, headers: privateHeaders });
  return Response.json(await readSnapshot(), { headers: privateHeaders });
}

export async function POST(request: Request) {
  if (!await hasValidShopAdminCookie()) return Response.json({ error: "PIN required" }, { status: 401, headers: privateHeaders });
  if (!sameOrigin(request)) return Response.json({ error: "Same-origin JSON required" }, { status: 403, headers: privateHeaders });
  try {
    const limit = await consumeRateLimit(`${snapshotKey()}:refresh`, 1, 30);
    if (!limit.allowed) return Response.json({ error: "Please wait before refreshing again." }, { status: 429, headers: { ...privateHeaders, "Retry-After": String(limit.retryAfterSeconds) } });
    return Response.json(await refreshSnapshot(), { headers: privateHeaders });
  } catch {
    return Response.json({ error: "Refresh unavailable. Saved snapshot has been kept." }, { status: 503, headers: privateHeaders });
  }
}
