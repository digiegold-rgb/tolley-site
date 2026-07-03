import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { validateShopAdmin } from "@/lib/shop-auth";
import { buildConsentUrl } from "@/lib/ebay/oauth";

export const runtime = "nodejs";

const STATE_COOKIE = "ebay_oauth_state";

export async function GET() {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let consentUrl: string;
  try {
    const state = randomBytes(24).toString("hex");
    consentUrl = buildConsentUrl({ state });

    const jar = await cookies();
    jar.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Consent URL build failed" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(consentUrl, 302);
}
