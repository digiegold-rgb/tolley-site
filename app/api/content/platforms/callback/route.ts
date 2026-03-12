import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdapter } from "@/lib/content/platforms";
import type { PlatformType } from "@/lib/content/types";

/**
 * GET /api/content/platforms/callback
 * OAuth callback — exchange code for tokens and store in PlatformConnection.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/leads/content/settings?error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/leads/content/settings?error=missing_code", req.url)
    );
  }

  // Decode state
  let stateData: { subscriberId: string; platform: PlatformType };
  try {
    stateData = JSON.parse(Buffer.from(state, "base64url").toString());
  } catch {
    return NextResponse.redirect(
      new URL("/leads/content/settings?error=invalid_state", req.url)
    );
  }

  const { subscriberId, platform } = stateData;

  const adapter = getAdapter(platform);
  if (!adapter) {
    return NextResponse.redirect(
      new URL(`/leads/content/settings?error=unsupported_platform`, req.url)
    );
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.VERCEL_URL}`;
    const redirectUri = `${baseUrl}/api/content/platforms/callback`;

    const tokens = await adapter.handleCallback(code, redirectUri);

    // Upsert platform connection
    await prisma.platformConnection.upsert({
      where: {
        subscriberId_platform_platformAccountId: {
          subscriberId,
          platform,
          platformAccountId: tokens.platformAccountId,
        },
      },
      create: {
        subscriberId,
        platform,
        platformAccountId: tokens.platformAccountId,
        platformUsername: tokens.platformUsername,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes || [],
        pageId: tokens.pageId,
        pageName: tokens.pageName,
        status: "active",
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes || [],
        platformUsername: tokens.platformUsername,
        pageId: tokens.pageId,
        pageName: tokens.pageName,
        status: "active",
        lastError: null,
      },
    });

    return NextResponse.redirect(
      new URL(`/leads/content/settings?connected=${platform}`, req.url)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error(`[content/callback] ${platform} error:`, msg);
    return NextResponse.redirect(
      new URL(`/leads/content/settings?error=${encodeURIComponent(msg.slice(0, 100))}`, req.url)
    );
  }
}
