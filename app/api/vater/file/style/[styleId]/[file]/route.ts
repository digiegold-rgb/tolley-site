/**
 * GET /api/vater/file/style/[styleId]/[file] — character/style asset proxy
 * (2026-08-20).
 *
 * DGX-rendered character images live behind the autopilot's bearer auth, so
 * a raw https://api-autopilot.tolley.io/vater/file/... URL is a 401 broken
 * image in every customer browser (found while building the Character Lab —
 * all pre-existing YouTubeCharacter.imageUrl rows had this bug). This route
 * streams the file with the server-side key, gated on style visibility:
 * your own styles and system styles, same rule as the style read paths.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { PERMANENT_STILL_CACHE_CONTROL } from "@/lib/vater/permanent-still";

type Ctx = { params: Promise<{ styleId: string; file: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { styleId, file } = await ctx.params;
  if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(file) || file.includes("..")) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(styleId)) {
    return NextResponse.json({ error: "Invalid styleId" }, { status: 400 });
  }

  // Visibility: own style, system style, or a style id that never made it to
  // Postgres (Character Lab takes render under the real style id, so an
  // unknown id means a stale/QA asset — deny).
  const style = await prisma.youTubeStyle.findUnique({
    where: { id: styleId },
    select: { userId: true, isSystem: true },
  });
  if (!style) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!style.isSystem && style.userId && style.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const autopilotUrl = (process.env.AUTOPILOT_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.CONTENT_API_KEY || "";
  if (!autopilotUrl || !apiKey) {
    return NextResponse.json({ error: "Autopilot not configured" }, { status: 500 });
  }

  const upstream = await fetch(
    `${autopilotUrl}/vater/file/style/${styleId}/${file}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "File unavailable", status: upstream.status },
      { status: upstream.status === 404 ? 404 : 502 },
    );
  }
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": PERMANENT_STILL_CACHE_CONTROL,
    },
  });
}
