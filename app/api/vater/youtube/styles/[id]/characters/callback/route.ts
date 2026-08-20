/**
 * POST/PATCH /api/vater/youtube/styles/[id]/characters/callback
 *
 * DGX worker calls this with the generated character. Auth via
 * Bearer CONTENT_API_KEY.
 *
 * Body: { styleId, name, description, imageUrl?, error? }
 *
 * Inserts a new YouTubeCharacter row. imageUrl from DGX is a relative
 * /vater/file/style/... path which the frontend serves through the
 * existing /vater/file/* proxy on the autopilot.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  return auth.slice(7).trim() === (process.env.CONTENT_API_KEY || "");
}

async function handle(req: NextRequest, ctx: Ctx) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: {
    name?: string;
    description?: string;
    briefDescription?: string;
    imageUrl?: string | null;
    error?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.error) {
    // The job failed on DGX side. Don't insert a half-character; just log
    // and return 200 so the worker doesn't retry the callback. Surface
    // visibility via the next user GET (optional: persist a failed marker).
    console.error(`[characters/callback] DGX failed for style ${id}: ${body.error}`);
    return NextResponse.json({ ok: true, error: body.error });
  }

  const name = (body.name || "").trim();
  const description = (body.description || "").trim();
  if (!name || description.length < 50) {
    return NextResponse.json(
      { error: "name + description (≥50 chars) required" },
      { status: 400 },
    );
  }

  const style = await prisma.youTubeStyle.findUnique({ where: { id } });
  if (!style) {
    return NextResponse.json({ error: "Style not found" }, { status: 404 });
  }

  // Store the SITE proxy path (2026-08-20). DGX gives a relative path like
  // "/vater/file/style/{styleId}/{filename}.png"; the old absolute
  // AUTOPILOT_URL form is bearer-authed → a broken image in every customer
  // browser. /api/vater/file/style/... streams it with the server key.
  const fileMatch = body.imageUrl?.match(
    /\/vater\/file\/style\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/,
  );
  const imageUrl = fileMatch
    ? `/api/vater/file/style/${fileMatch[1]}/${fileMatch[2]}`
    : body.imageUrl?.startsWith("http")
      ? body.imageUrl
      : null;

  const character = await prisma.youTubeCharacter.create({
    data: {
      styleId: id,
      name,
      description,
      briefDescription: body.briefDescription || null,
      imageUrl,
      permanent: true,
      placeInEveryImage: false,
    },
  });
  return NextResponse.json({ ok: true, character });
}

export const POST = handle;
export const PATCH = handle;
