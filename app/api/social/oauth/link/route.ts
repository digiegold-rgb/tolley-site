import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { mintOauthLinkToken } from "@/lib/oauth-link-token";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDERS = ["facebook", "pinterest"] as const;

/**
 * GET /api/social/oauth/link?provider=facebook|pinterest
 * Mints a 24h magic link for the provider's OAuth start route. Auth: admin
 * session OR x-sync-secret header (DGX agents mint links to send via Telegram).
 * Replaces the old ?key=<SYNC_SECRET> links, which leaked the permanent secret
 * into access logs / browser history / Referer headers.
 */
export async function GET(request: NextRequest) {
  const sync = request.headers.get("x-sync-secret");
  const syncOk = !!sync && secretEquals(sync, process.env.SYNC_SECRET);
  if (!syncOk) {
    const auth = await requireAdminApiSession();
    if (!auth.ok) return auth.response;
  }

  const provider = request.nextUrl.searchParams.get("provider");
  if (!provider || !(PROVIDERS as readonly string[]).includes(provider)) {
    return NextResponse.json({ error: "provider must be facebook or pinterest" }, { status: 400 });
  }

  const token = mintOauthLinkToken(provider);
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    url: `${origin}/api/social/oauth/${provider}/start?t=${token}`,
    expiresAt: new Date(Number(token.split(".")[0])).toISOString(),
  });
}
