import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { parseMileIqLog, summarize } from "@/lib/account/mileage";

// POST /api/account/mileage/import  body: { text: "<MileIQ detailed log>" }
// Idempotent: trips dedupe on startDate|stopAddr|miles, so re-importing the
// same export adds nothing new.
export async function POST(request: NextRequest) {
  const check = await requireAdminApiSession();
  if (check instanceof NextResponse) return check;

  let text = "";
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    text = String(body.text || "");
  } else {
    text = await request.text();
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "no log text provided" }, { status: 400 });
  }

  const { trips, skipped } = parseMileIqLog(text);
  if (trips.length === 0) {
    return NextResponse.json(
      { error: "no valid trips found in log", skipped },
      { status: 400 }
    );
  }

  let inserted = 0;
  let duplicates = 0;
  // createMany with skipDuplicates relies on the unique dedupeKey.
  const result = await prisma.mileageTrip.createMany({
    data: trips,
    skipDuplicates: true,
  });
  inserted = result.count;
  duplicates = trips.length - inserted;

  return NextResponse.json({
    parsed: trips.length,
    inserted,
    duplicates,
    skipped,
    summary: summarize(trips),
  });
}
