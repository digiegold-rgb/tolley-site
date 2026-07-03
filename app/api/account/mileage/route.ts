import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { summarize } from "@/lib/account/mileage";

// GET /api/account/mileage?year=2026  -> trips + IRS deduction summary
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

  const years = await prisma.mileageTrip.findMany({
    distinct: ["year"],
    select: { year: true },
    orderBy: { year: "desc" },
  });

  const summary = summarize(trips);

  return NextResponse.json({
    year: yearParam ? Number(yearParam) : null,
    years: years.map((y) => y.year),
    summary,
    trips,
  });
}

// DELETE /api/account/mileage?year=2026  -> clear a year (re-import fresh)
export async function DELETE(request: NextRequest) {
  const check = await requireAdminApiSession();
  if (check instanceof NextResponse) return check;

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  if (!yearParam) {
    return NextResponse.json({ error: "year required" }, { status: 400 });
  }

  const result = await prisma.mileageTrip.deleteMany({
    where: { year: Number(yearParam) },
  });
  return NextResponse.json({ deleted: result.count });
}
