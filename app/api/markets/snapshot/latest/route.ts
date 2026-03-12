import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/markets/snapshot/latest — Latest daily dashboard snapshot (public)
 */
export async function GET() {
  const snapshot = await prisma.marketSnapshot.findFirst({
    orderBy: { date: "desc" },
  });

  if (!snapshot) {
    return NextResponse.json({ snapshot: null });
  }

  return NextResponse.json({ snapshot });
}
