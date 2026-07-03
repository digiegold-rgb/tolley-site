/**
 * GET /api/shop/deals/penny — community Home Depot penny ($0.01) lead board.
 * Auth: shop admin session. Query: ?near=1 to keep only KC-area (MO/KS) leads.
 *
 * Proxies PennyCentral's free crowd-sourced list (cached 5 min). These are
 * LEADS to verify in-store — penny prices never appear in online price feeds.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";
import { fetchPennyList } from "@/lib/shop/penny-list";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const near = req.nextUrl.searchParams.get("near") === "1";
  const result = await fetchPennyList({ nearOnly: near });
  return NextResponse.json(result);
}
