import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode, verifyBackupCode } from "@/lib/mfa";
import { requireMfaRequest } from "@/lib/auth/mfa-request";
import { enrollmentKey, mfaCookie, signMfaProof } from "@/lib/auth/mfa-session";

export async function POST(request: NextRequest) {
  const guard = await requireMfaRequest(request);
  if (guard.response) return guard.response;
  const { userId, sessionId } = guard.identity!;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.code !== "string" || !/^(?:\d{6}|[a-fA-F0-9]{8})$/.test(body.code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }
  const key = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const mfa = await tx.userMfa.findUnique({ where: { userId } });
    if (!mfa) return null;
    if (body.isBackupCode === true) {
      if (!mfa.verified) return null;
      const codes = await tx.mfaBackupCode.findMany({ where: { userId, usedAt: null } });
      let consumed = false;
      for (const code of codes) {
        if (await verifyBackupCode(body.code.toLowerCase(), code.codeHash)) {
          const result = await tx.mfaBackupCode.updateMany({ where: { id: code.id, usedAt: null },
            data: { usedAt: new Date() } });
          consumed = result.count === 1;
          break;
        }
      }
      if (!consumed) return null;
    } else {
      if (!verifyTotpCode(mfa.totpSecret, body.code)) return null;
      const replayKey = `mfa:replay:${userId}:${body.code}`;
      const now = new Date();
      const rows = await tx.$queryRaw<Array<{ count: number }>>`
        INSERT INTO "RateLimitBucket" (key, count, "windowStart") VALUES (${replayKey}, 1, ${now})
        ON CONFLICT (key) DO UPDATE SET count = CASE WHEN "RateLimitBucket"."windowStart" < ${new Date(now.getTime() - 90000)} THEN 1 ELSE "RateLimitBucket".count + 1 END,
        "windowStart" = CASE WHEN "RateLimitBucket"."windowStart" < ${new Date(now.getTime() - 90000)} THEN EXCLUDED."windowStart" ELSE "RateLimitBucket"."windowStart" END
        RETURNING count`;
      if (rows[0]?.count !== 1) return null;
    }
    if (!mfa.verified) await tx.userMfa.update({ where: { userId }, data: { verified: true, enabledAt: new Date() } });
    return enrollmentKey(mfa);
  }, { timeout: 15000 });
  if (!key) return NextResponse.json({ error: "Invalid or already used code" }, { status: 403 });
  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(mfaCookie(signMfaProof(userId, sessionId, key)));
  return response;
}
