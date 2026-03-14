import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credit = await prisma.videoCredit.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json({
    balance: credit?.balance ?? 0,
    totalUsed: credit?.totalUsed ?? 0,
    totalPurchased: credit?.totalPurchased ?? 0,
    subscriptionTier: credit?.subscriptionTier ?? null,
    monthlyAllotment: credit?.monthlyAllotment ?? 0,
    rolloverCredits: credit?.rolloverCredits ?? 0,
    packsPurchased: credit?.packsPurchased ?? 0,
  });
}
