import { NextRequest, NextResponse } from "next/server";

/**
 * Meta Shop "checkout on another website" landing URL.
 * Commerce Manager sends buyers here as:
 *   /checkout?products=<productId>:<qty>[,<id>:<qty>...]&coupon=<code>
 * The shop is single-item local-pickup (no cart), so we send the buyer to
 * the first product's page; product ids match /api/shop/meta-feed.
 */
export function GET(req: NextRequest) {
  const products = req.nextUrl.searchParams.get("products") ?? "";
  const coupon = req.nextUrl.searchParams.get("coupon");

  const firstId = products.split(",")[0]?.split(":")[0]?.trim();
  const dest = req.nextUrl.clone();
  dest.pathname = firstId ? `/shop/${firstId}` : "/shop";
  dest.search = "";
  dest.searchParams.set("utm_source", "meta_shop");
  if (coupon) dest.searchParams.set("coupon", coupon);

  return NextResponse.redirect(dest, 307);
}
