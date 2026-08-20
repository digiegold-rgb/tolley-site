/**
 * POST /api/vater/youtube/styles/[id]/characters/adopt — Character Lab
 * (2026-08-20).
 *
 * Persists ONE picked take from a variants batch as a real YouTubeCharacter
 * on the style. Session-authed twin of the DGX callback route's write: same
 * descriptor length contract (≥50 chars), same relative→absolute imageUrl
 * resolution, same permanent/placeInEveryImage defaults. Free — the batch
 * was already charged at generation time.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const style = await prisma.youTubeStyle.findUnique({
    where: { id },
    select: { id: true, userId: true, isSystem: true },
  });
  if (!style) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (style.userId && style.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (style.isSystem) {
    return NextResponse.json(
      { error: "System styles are immutable. Clone first." },
      { status: 403 },
    );
  }

  let body: { name?: string; description?: string; imageUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = (body.name || "").trim();
  const description = (body.description || "").trim();
  let imageUrl = (body.imageUrl || "").trim() || null;

  if (!name || name.length > 80) {
    return NextResponse.json({ error: "name (1-80 chars) required" }, { status: 400 });
  }
  if (description.length < 50) {
    return NextResponse.json(
      { error: "description too short (≥50 chars) — not a usable descriptor" },
      { status: 400 },
    );
  }
  // Job results carry a DGX-relative /vater/file/... path. Store the SITE
  // proxy path — the raw autopilot URL is bearer-authed and renders as a
  // broken image in customer browsers.
  if (imageUrl) {
    const m = imageUrl.match(/\/vater\/file\/style\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/);
    imageUrl = m ? `/api/vater/file/style/${m[1]}/${m[2]}` : imageUrl.includes("://") ? imageUrl : null;
  }

  const character = await prisma.youTubeCharacter.create({
    data: {
      styleId: id,
      name,
      description,
      imageUrl,
      permanent: true,
      placeInEveryImage: false,
    },
  });
  return NextResponse.json({ character });
}
