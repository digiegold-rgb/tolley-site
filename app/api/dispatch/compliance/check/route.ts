import { NextRequest, NextResponse } from "next/server";
import { runComplianceCheck } from "@/lib/dispatch/compliance";

export const runtime = "nodejs";

/** POST — Cron-triggered compliance check (run daily)
 *  Checks all driver documents for expiration, sends warnings, suspends expired drivers.
 *  Secure with SYNC_SECRET header.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-sync-secret");
  if (secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runComplianceCheck();

  return NextResponse.json({
    success: true,
    ...result,
  });
}
