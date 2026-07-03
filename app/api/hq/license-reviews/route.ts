/**
 * GET /api/hq/license-reviews — digest subscribers whose real-estate license
 * is awaiting manual verification (licenseStatus = "manual_review": all KS
 * signups, plus MO signups that arrived while the state registry was down).
 * Feeds the License Reviews section of the Growth HQ Approvals tab.
 */

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";

export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const reviews = await prisma.digestSubscriber.findMany({
      where: { licenseStatus: "manual_review" },
      orderBy: { joinedAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        farmZips: true,
        status: true,
        licenseState: true,
        licenseNumber: true,
        joinedAt: true,
      },
    });
    return NextResponse.json({ reviews });
  } catch (err) {
    console.error("[hq/license-reviews] list failed", err);
    return NextResponse.json({ error: "Failed to load license reviews" }, { status: 500 });
  }
}
