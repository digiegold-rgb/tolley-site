import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTotpSecret, generateBackupCodes, hashBackupCode } from "@/lib/mfa";
import { requireMfaRequest } from "@/lib/auth/mfa-request";

export async function POST(request: NextRequest) {
  const guard = await requireMfaRequest(request);
  if (guard.response) return guard.response;
  const { userId, email } = guard.identity!;
  const { secret, qrCodeDataUrl } = await generateTotpSecret(email);
  const backupCodes = generateBackupCodes(8);
  const hashes = await Promise.all(backupCodes.map(hashBackupCode));
  const saved = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    if ((await tx.userMfa.findUnique({ where: { userId } }))?.verified) return false;
    await tx.userMfa.upsert({ where: { userId }, create: { userId, totpSecret: secret },
      update: { totpSecret: secret, verified: false, enabledAt: null } });
    await tx.mfaBackupCode.deleteMany({ where: { userId } });
    await tx.mfaBackupCode.createMany({ data: hashes.map(codeHash => ({ userId, codeHash })) });
    return true;
  });
  if (!saved) return NextResponse.json({ error: "MFA already enabled" }, { status: 409 });
  return NextResponse.json({ qrCodeDataUrl, secret, backupCodes }, { headers: { "Cache-Control": "no-store" } });
}
