import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateShopAdmin } from "@/lib/shop-auth";
import { exchangeAuthorizationCode } from "@/lib/ebay/oauth";

export const runtime = "nodejs";

const STATE_COOKIE = "ebay_oauth_state";

export async function GET(req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  if (error) {
    return NextResponse.redirect(
      new URL(`/shop/admin?ebay_error=${encodeURIComponent(error)}`, req.url),
      302
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/shop/admin?ebay_error=missing_code", req.url),
      302
    );
  }
  if (!expectedState || state !== expectedState) {
    return NextResponse.redirect(
      new URL("/shop/admin?ebay_error=state_mismatch", req.url),
      302
    );
  }

  try {
    await exchangeAuthorizationCode(code);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "exchange_failed";
    return NextResponse.redirect(
      new URL(`/shop/admin?ebay_error=${encodeURIComponent(msg)}`, req.url),
      302
    );
  }

  return NextResponse.redirect(new URL("/shop/admin?ebay_connected=1", req.url), 302);
}
