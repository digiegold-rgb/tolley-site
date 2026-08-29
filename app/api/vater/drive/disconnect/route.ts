/**
 * POST /api/vater/drive/disconnect — revoke at Google (best effort) and drop
 * the ROOT user's VaterDriveConnection. Docs already in their Drive stay —
 * they own them. → {ok:true} (idempotent).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { resolveTenantIdentity } from "@/lib/vater/tenant-identity";
import { revokeGoogleToken } from "@/lib/vater/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { rootUserId } = await resolveTenantIdentity(session.user.id);
  const conn = await prisma.vaterDriveConnection.findUnique({
    where: { userId: rootUserId },
    select: { id: true, refreshToken: true },
  });
  if (conn) {
    await revokeGoogleToken(conn.refreshToken);
    await prisma.vaterDriveConnection.deleteMany({ where: { id: conn.id } });
    console.log(`[vater/drive] disconnected root=${rootUserId}`);
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
