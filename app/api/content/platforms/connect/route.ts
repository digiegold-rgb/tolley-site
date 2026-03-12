import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/content/platforms";
import type { PlatformType } from "@/lib/content/types";
import crypto from "crypto";

/**
 * POST /api/content/platforms/connect
 * Initiate OAuth flow for a platform.
 * Body: { platform, subscriberId }
 * Returns: { authUrl }
 */
export async function POST(req: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth = req.headers.get("x-sync-secret");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { platform, subscriberId } = body as {
    platform: PlatformType;
    subscriberId: string;
  };

  if (!platform || !subscriberId) {
    return NextResponse.json(
      { error: "platform and subscriberId required" },
      { status: 400 }
    );
  }

  const adapter = getAdapter(platform);
  if (!adapter) {
    return NextResponse.json(
      { error: `Platform "${platform}" not supported yet` },
      { status: 400 }
    );
  }

  // Generate state token with subscriberId encoded
  const state = Buffer.from(
    JSON.stringify({
      subscriberId,
      platform,
      nonce: crypto.randomBytes(16).toString("hex"),
    })
  ).toString("base64url");

  const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.VERCEL_URL}`;
  const redirectUri = `${baseUrl}/api/content/platforms/callback`;

  const authUrl = adapter.getAuthUrl(state, redirectUri);

  return NextResponse.json({ authUrl, state });
}
