// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode } from "@/lib/mfa";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await request.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Code required" }, { status: 400 });
  }

  const userId = session.user.id;
  const mfa = await prisma.userMfa.findUnique({ where: { userId } });
  if (!mfa?.verified) {
    return NextResponse.json({ error: "MFA not enabled" }, { status: 400 });
  }

  if (!verifyTotpCode(mfa.totpSecret, code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 403 });
  }

  // Delete MFA and backup codes
  await prisma.mfaBackupCode.deleteMany({ where: { userId } });
  await prisma.userMfa.delete({ where: { userId } });

  return NextResponse.json({ success: true, mfaDisabled: true });
}
