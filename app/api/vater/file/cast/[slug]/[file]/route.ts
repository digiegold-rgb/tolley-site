/**
 * GET /api/vater/file/cast/[slug]/[file] — canon cast reference stills.
 *
 * Same shape as the style-asset proxy next door: the DGX serves these behind
 * the autopilot bearer token, so a raw URL is a 401 broken image in the
 * browser. Gated to the house lane (vater admins + studio allowlist) because
 * the roster itself is.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isVaterAdminEmail, isVaterStudioEmail } from "@/lib/admin-auth";

type Ctx = { params: Promise<{ slug: string; file: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = session.user.email;
  if (!isVaterAdminEmail(email) && !isVaterStudioEmail(email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { slug, file } = await ctx.params;
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(file) || file.includes("..")) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const autopilotUrl = (process.env.AUTOPILOT_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.CONTENT_API_KEY || "";
  if (!autopilotUrl || !apiKey) {
    return NextResponse.json({ error: "Autopilot not configured" }, { status: 500 });
  }

  const upstream = await fetch(`${autopilotUrl}/vater/file/cast/${slug}/${file}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "File unavailable", status: upstream.status },
      { status: upstream.status === 404 ? 404 : 502 },
    );
  }
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
