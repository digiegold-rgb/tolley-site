/**
 * GET /api/vater/youtube/locked-style
 *
 * The one style Script Review renders in (2026-08-10, Trey — the picker is
 * gone). Returns the resolved row so the screen can show what it's actually
 * bound to, and can warn loudly if the account has no such style instead of
 * silently rendering in a different look.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveLockedStyle, LOCKED_STYLE_NAME } from "@/lib/vater/locked-style";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const style = await resolveLockedStyle(session.user.id);
  return NextResponse.json({ style, expectedName: LOCKED_STYLE_NAME });
}
