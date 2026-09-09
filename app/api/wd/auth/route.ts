import { NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";
export async function POST() {
  const admin = await validateWdAdmin();
  return admin.authed ? NextResponse.json({ ok: true, role: admin.role })
    : NextResponse.json({ error: "Sign in with your owner account and complete two-factor authentication.",
      loginUrl: "/login?callbackUrl=%2Fwd%2Fadmin" }, { status: 401 });
}
