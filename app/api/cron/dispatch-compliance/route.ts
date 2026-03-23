import { NextRequest, NextResponse } from "next/server";
import { runComplianceCheck } from "@/lib/dispatch/compliance";

export const runtime = "nodejs";

/** Daily compliance check — warns drivers about expiring docs, suspends expired */
export async function GET(request: NextRequest) {
  // Vercel cron sends CRON_SECRET in Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runComplianceCheck();

  return NextResponse.json({
    success: true,
    ...result,
  });
}
