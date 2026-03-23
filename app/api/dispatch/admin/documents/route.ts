import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** GET — List all documents pending review (or filter by status) */
export async function GET(request: NextRequest) {
  const check = await requireAdminApiSession();
  if (!check.ok) return check.response;

  const status = request.nextUrl.searchParams.get("status") || "pending";

  const documents = await prisma.driverDocument.findMany({
    where: { status },
    include: {
      driver: {
        select: { id: true, name: true, phone: true, vehicleType: true, status: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const counts = await prisma.driverDocument.groupBy({
    by: ["status"],
    _count: true,
  });

  return NextResponse.json({
    documents,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
  });
}
