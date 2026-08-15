import { NextResponse } from "next/server";

import { clearWdAdminCookie } from "@/lib/wd-auth";

export const runtime = "nodejs";

/**
 * POST /api/hq/logout — clear the shared wd_admin cookie. Deliberately
 * unauthenticated: the only thing it can do is drop the caller's own session,
 * and refusing an unauthenticated logout would just leave a stale cookie in
 * place. Also ends the /wd/admin session (one cookie, both dashboards).
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  const cookie = clearWdAdminCookie();
  response.cookies.set(cookie.name, cookie.value, {
    maxAge: cookie.maxAge,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
  });
  return response;
}
