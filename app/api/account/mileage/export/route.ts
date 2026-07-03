import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { tripsToCsv } from "@/lib/account/mileage";

// GET /api/account/mileage/export?year=2026 -> IRS-compliant CSV download
export async function GET(request: NextRequest) {
  const check = await requireAdminApiSession();
  if (check instanceof NextResponse) return check;

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const where = yearParam ? { year: Number(yearParam) } : {};

  const trips = await prisma.mileageTrip.findMany({
    where,
    orderBy: { startDate: "asc" },
  });

  const csv = tripsToCsv(trips);
  const fname = `mileage-log-${yearParam || "all"}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
