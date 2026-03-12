import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/content/platforms
 * List connected platforms for a subscriber.
 * Auth: x-sync-secret or ?key=
 */
export async function GET(req: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth =
    req.headers.get("x-sync-secret") ||
    req.nextUrl.searchParams.get("key");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscriberId = req.nextUrl.searchParams.get("subscriberId");
  if (!subscriberId) {
    return NextResponse.json({ error: "subscriberId required" }, { status: 400 });
  }

  const connections = await prisma.platformConnection.findMany({
    where: { subscriberId },
    select: {
      id: true,
      platform: true,
      platformAccountId: true,
      platformUsername: true,
      pageId: true,
      pageName: true,
      status: true,
      lastError: true,
      tokenExpiresAt: true,
      scopes: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ connections });
}
