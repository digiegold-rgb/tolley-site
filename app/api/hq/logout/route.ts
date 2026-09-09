import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearGenerateLibraryCookie } from "@/lib/generate-library-auth";
import { clearWdAdminCookie } from "@/lib/wd-auth";

export const runtime = "nodejs";

/**
 * POST /api/hq/logout — clear the shared wd_admin cookie. Deliberately
 * unauthenticated: the only thing it can do is drop the caller's own session,
 * and refusing an unauthenticated logout would just leave a stale cookie in
 * place. Also ends the /wd/admin session (one cookie, both dashboards) and
 * the /generate library unlock cookie.
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  for (const cookie of [clearWdAdminCookie(), clearGenerateLibraryCookie()]) {
    response.cookies.set(cookie.name, cookie.value, {
      maxAge: cookie.maxAge,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
    });
  }
  for (const cookie of (await cookies()).getAll()) {
    if (cookie.name.includes("authjs.session-token") || cookie.name === "tolley_mfa") {
      response.cookies.set(cookie.name, "", { maxAge: 0, path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
    }
  }
  return response;
}
