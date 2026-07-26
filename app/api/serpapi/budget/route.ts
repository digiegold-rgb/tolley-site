/**
 * GET /api/serpapi/budget — per-integration spend vs cap for the current
 * SerpAPI billing cycle.
 *
 * Exists because the account hit its 1,000-search ceiling two months running
 * and there was no way to see WHICH integration was eating it without running
 * SQL by hand. Now the answer is one request.
 */

import { NextResponse } from "next/server";
import { budgetReport, billingCycleStart } from "@/lib/serpapi";
import { validateShopAdmin } from "@/lib/shop-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await budgetReport();
    const totalUsed = rows.reduce((s, r) => s + r.used, 0);
    const totalCap = rows.reduce((s, r) => s + r.cap, 0);

    return NextResponse.json({
      cycleStart: billingCycleStart().toISOString(),
      planLimit: 1000,
      totalUsed,
      totalCap,
      // Integrations at or over their ceiling — these are the ones silently
      // skipping calls right now.
      exhausted: rows.filter((r) => r.used >= r.cap && r.cap > 0).map((r) => r.integration),
      integrations: rows,
    });
  } catch (err) {
    console.error("[serpapi/budget]", err);
    return NextResponse.json({ error: "Failed to build budget report" }, { status: 500 });
  }
}
