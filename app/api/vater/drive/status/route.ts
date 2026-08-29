/**
 * GET /api/vater/drive/status — the Drive card's one read (2026-08-28).
 * Resolved for the ROOT login so every workspace tab sees the same link.
 *   { connected, email, folderUrl, status: "active"|"revoked"|"error"|null, lastError }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { resolveTenantIdentity } from "@/lib/vater/tenant-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DriveStatusResponse {
  connected: boolean;
  email: string | null;
  folderUrl: string | null;
  status: "active" | "revoked" | "error" | null;
  lastError: string | null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { rootUserId } = await resolveTenantIdentity(session.user.id);
  const conn = await prisma.vaterDriveConnection.findUnique({
    where: { userId: rootUserId },
    select: { googleEmail: true, folderUrl: true, status: true, lastError: true },
  });
  const body: DriveStatusResponse = conn
    ? {
        connected: true,
        email: conn.googleEmail,
        folderUrl: conn.folderUrl,
        status: conn.status === "revoked" || conn.status === "error" ? conn.status : "active",
        lastError: conn.lastError,
      }
    : { connected: false, email: null, folderUrl: null, status: null, lastError: null };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
