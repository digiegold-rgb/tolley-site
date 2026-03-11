/**
 * GET /api/unclaimed/scan/[id] — Get scan status + results
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const { id } = await params;

  const scan = await prisma.unclaimedFundScan.findUnique({
    where: { id },
    include: {
      funds: {
        include: {
          claim: true,
        },
        orderBy: { matchConfidence: "desc" },
      },
    },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  if (scan.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ scan });
}
