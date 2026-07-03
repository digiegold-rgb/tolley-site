import { NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";
import { resolveAndCachePolicies } from "@/lib/ebay/policies";
import { ensureDefaultLocation } from "@/lib/ebay/locations";

export const runtime = "nodejs";

/**
 * One-shot: pull the seller's payment/return/fulfillment policy IDs and
 * create a default inventory location. Idempotent — safe to re-run.
 * Run after Connect eBay before listing for the first time.
 */
export async function POST() {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [policies, locationKey] = await Promise.all([
      resolveAndCachePolicies(),
      ensureDefaultLocation(),
    ]);
    return NextResponse.json({ ok: true, policies, locationKey });
  } catch (err) {
    const message = err instanceof Error ? err.message : "setup_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
