import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode } from "@/lib/mfa";
import { requireMfaRequest } from "@/lib/auth/mfa-request";
import { MFA_COOKIE, requiresOwnerMfa } from "@/lib/auth/mfa-session";

export async function POST(request: NextRequest) {
  const guard = await requireMfaRequest(request);
  if (guard.response) return guard.response;
  const { userId, email } = guard.identity!;
  if (await requiresOwnerMfa(userId, email)) return NextResponse.json({ error: "Owner accounts require two-factor authentication." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (typeof body?.code !== "string") return NextResponse.json({ error: "Code required" }, { status: 400 });
  const disabled = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const mfa = await tx.userMfa.findUnique({ where: { userId } });
    if (!mfa?.verified || !verifyTotpCode(mfa.totpSecret, body.code)) return false;
    await tx.mfaBackupCode.deleteMany({ where: { userId } });
    await tx.userMfa.delete({ where: { userId } });
    await tx.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
    return true;
  });
  if (!disabled) return NextResponse.json({ error: "Invalid code" }, { status: 403 });
  const response = NextResponse.json({ success: true, mfaDisabled: true });
  response.cookies.delete(MFA_COOKIE);
  return response;
}
