// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode, verifyBackupCode } from "@/lib/mfa";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code, isBackupCode } = await request.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Code required" }, { status: 400 });
  }

  const userId = session.user.id;
  const mfa = await prisma.userMfa.findUnique({ where: { userId } });
  if (!mfa) {
    return NextResponse.json({ error: "MFA not set up" }, { status: 400 });
  }

  let valid = false;

  if (isBackupCode) {
    // Try each unused backup code
    const unusedCodes = await prisma.mfaBackupCode.findMany({
      where: { userId, usedAt: null },
    });
    for (const bc of unusedCodes) {
      if (await verifyBackupCode(code, bc.codeHash)) {
        await prisma.mfaBackupCode.update({
          where: { id: bc.id },
          data: { usedAt: new Date() },
        });
        valid = true;
        break;
      }
    }
  } else {
    valid = verifyTotpCode(mfa.totpSecret, code);
  }

  if (!valid) {
    return NextResponse.json({ error: "Invalid code" }, { status: 403 });
  }

  // If this is the first verification (setup confirmation), mark as verified
  if (!mfa.verified) {
    await prisma.userMfa.update({
      where: { userId },
      data: { verified: true, enabledAt: new Date() },
    });
  }

  return NextResponse.json({ success: true, mfaCleared: true });
}
