import { NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";
import { getEbayConnectionStatus } from "@/lib/ebay/oauth";

export const runtime = "nodejs";

export async function GET() {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = await getEbayConnectionStatus();
  return NextResponse.json({ status });
}
