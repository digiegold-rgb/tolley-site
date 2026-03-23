// @ts-nocheck — references removed Prisma models
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateTotpSecret, generateBackupCodes, hashBackupCode } from "@/lib/mfa";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const email = session.user.email || "user";

  // Check if MFA already enabled
  const existing = await prisma.userMfa.findUnique({ where: { userId } });
  if (existing?.verified) {
    return NextResponse.json({ error: "MFA already enabled" }, { status: 400 });
  }

  // Generate TOTP secret and QR code
  const { secret, qrCodeDataUrl } = await generateTotpSecret(email);

  // Generate backup codes
  const backupCodes = generateBackupCodes(8);
  const hashedCodes = await Promise.all(backupCodes.map(hashBackupCode));

  // Store (upsert) — not verified until user confirms with a code
  await prisma.userMfa.upsert({
    where: { userId },
    create: { userId, totpSecret: secret },
    update: { totpSecret: secret, verified: false, enabledAt: null },
  });

  // Replace old backup codes
  await prisma.mfaBackupCode.deleteMany({ where: { userId } });
  await prisma.mfaBackupCode.createMany({
    data: hashedCodes.map((codeHash) => ({ userId, codeHash })),
  });

  return NextResponse.json({
    qrCodeDataUrl,
    secret, // For manual entry
    backupCodes, // Show once, never again
  });
}
