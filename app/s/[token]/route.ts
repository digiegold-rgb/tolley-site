import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /s/[token]
 *
 * Resolves a ShareLink and 302-redirects to its path with `?ref=share&t=<token>`.
 * Click-counting is fire-and-forget (don't block the redirect).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token || !/^[A-Za-z0-9_-]{4,64}$/.test(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (link.expiresAt && link.expiresAt < new Date()) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }

  // Fire-and-forget click counter.
  void prisma.shareLink
    .update({
      where: { id: link.id },
      data: { clickCount: { increment: 1 }, lastClickedAt: new Date() },
    })
    .catch(() => {});

  const sep = link.path.includes("?") ? "&" : "?";
  const target = `${link.path}${sep}ref=share&t=${encodeURIComponent(token)}`;
  return NextResponse.redirect(new URL(target, "https://www.tolley.io"), 302);
}
