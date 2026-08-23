/**
 * POST /api/vater/roster/[slug]/reference — (re)render a cast portrait.
 *
 * Renders the LOCKED descriptor as-is on FireRed/Modal (~$0.03, ~30-90s) —
 * not /characters/generate, which would run Qwen and invent a fresh identity
 * first. These portraits are display + critique artifacts: the IP-Adapter
 * render anchor lives in ~/Shared/reference-library, so a bad portrait here
 * never leaks into a video.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isVaterAdminEmail, isVaterStudioEmail } from "@/lib/admin-auth";
import { dgxCall } from "@/lib/vater/dgx-feature-proxy";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = session.user.email;
  if (!isVaterAdminEmail(email) && !isVaterStudioEmail(email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }
  let body: { overwrite?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }

  const result = await dgxCall<{ referenceUrl: string; seed: number }>(
    "POST",
    `/vater/roster/${encodeURIComponent(slug)}/reference`,
    { overwrite: body.overwrite === true },
    240_000,
  );
  if (result.kind === "unavailable") {
    return NextResponse.json({ error: "Render box unreachable" }, { status: 503 });
  }
  if (result.kind === "error") {
    return NextResponse.json(
      { error: "Portrait render failed", detail: result.body.slice(0, 300) },
      { status: 502 },
    );
  }
  return NextResponse.json(result.data);
}
