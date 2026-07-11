/**
 * Social account management for the vater/youtube Library share feature.
 *
 * GET    — list all connected platforms for the current user
 * POST   — save/update credentials for a specific platform (manual-key path)
 *
 * Per-platform OAuth flows live under /api/vater/social-accounts/[platform]/oauth/*
 * and are placeholder stubs until each platform's integration ships. Manual
 * API key entry works today for anyone who already has a token.
 *
 * SECURITY: `credentials` is stored as-is in Postgres. For production we
 * should encrypt at rest (AES-GCM with a per-row IV), but for MVP we rely
 * on Neon's transport + at-rest encryption + the authenticated session.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  SUPPORTED_PLATFORMS,
  isSupportedPlatform as isSupported,
} from "@/lib/vater-social";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.socialAccount.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      platform: true,
      displayName: true,
      avatarUrl: true,
      status: true,
      lastError: true,
      connectedAt: true,
      lastUsedAt: true,
    },
    orderBy: { connectedAt: "desc" },
  });

  // Map to a platform → account shape so the UI can pre-render all 7 rows
  // and easily show the "Connect" vs "Connected" state without a client-side
  // lookup loop.
  const byPlatform = Object.fromEntries(accounts.map((a) => [a.platform, a]));

  return NextResponse.json({
    supported: SUPPORTED_PLATFORMS,
    accounts,
    byPlatform,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    platform?: unknown;
    displayName?: unknown;
    credentials?: unknown;
  };

  const platform =
    typeof body.platform === "string" && isSupported(body.platform)
      ? body.platform
      : null;
  if (!platform) {
    return NextResponse.json(
      {
        error: `platform required, one of: ${SUPPORTED_PLATFORMS.join(", ")}`,
      },
      { status: 400 },
    );
  }
  if (typeof body.credentials !== "object" || body.credentials === null) {
    return NextResponse.json(
      { error: "credentials object required" },
      { status: 400 },
    );
  }

  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim() : null;

  const account = await prisma.socialAccount.upsert({
    where: {
      userId_platform: { userId: session.user.id, platform },
    },
    create: {
      userId: session.user.id,
      platform,
      displayName,
      credentials: body.credentials as Prisma.InputJsonValue,
      status: "active",
    },
    update: {
      displayName,
      credentials: body.credentials as Prisma.InputJsonValue,
      status: "active",
      lastError: null,
    },
    select: {
      id: true,
      platform: true,
      displayName: true,
      status: true,
      connectedAt: true,
    },
  });

  return NextResponse.json({ ok: true, account });
}
