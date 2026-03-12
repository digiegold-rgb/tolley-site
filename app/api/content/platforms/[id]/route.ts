import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdapter } from "@/lib/content/platforms";
import type { PlatformType } from "@/lib/content/types";

/**
 * GET /api/content/platforms/[id] — test connection
 * DELETE /api/content/platforms/[id] — disconnect platform
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth =
    req.headers.get("x-sync-secret") ||
    req.nextUrl.searchParams.get("key");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conn = await prisma.platformConnection.findUnique({ where: { id } });
  if (!conn) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Test connection by trying to get engagement on a dummy post
  const adapter = getAdapter(conn.platform as PlatformType);
  if (!adapter) {
    return NextResponse.json({ status: "no_adapter", platform: conn.platform });
  }

  try {
    // Simple token validation — try to fetch user info
    // Each adapter's getPostEngagement will return zeros for invalid IDs without throwing
    await adapter.getPostEngagement("test", {
      accessToken: conn.accessToken,
      platformAccountId: conn.platformAccountId,
    });
    return NextResponse.json({ status: "active", platform: conn.platform });
  } catch {
    return NextResponse.json({ status: "error", platform: conn.platform });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth = req.headers.get("x-sync-secret");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.platformConnection.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
