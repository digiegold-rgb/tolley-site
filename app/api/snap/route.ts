import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/snap — list user's snap history
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snaps = await prisma.snapRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      photoUrl: true,
      resolvedAddress: true,
      resolvedCity: true,
      resolvedState: true,
      status: true,
      estimatedEquity: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ snaps });
}
