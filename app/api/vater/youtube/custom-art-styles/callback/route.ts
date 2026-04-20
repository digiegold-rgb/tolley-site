/**
 * POST/PATCH /api/vater/youtube/custom-art-styles/callback
 *
 * DGX worker calls this with the Gemini Flash-generated 800-char art-style
 * descriptor. Auth via Bearer CONTENT_API_KEY.
 *
 * Body: { customArtStyleId, name, description, error? }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  return auth.slice(7).trim() === (process.env.CONTENT_API_KEY || "");
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: {
    customArtStyleId?: string;
    name?: string;
    description?: string;
    error?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.customArtStyleId) {
    return NextResponse.json(
      { error: "customArtStyleId required" },
      { status: 400 },
    );
  }
  if (body.error) {
    console.error(
      `[custom-art-styles/callback] DGX failed for ${body.customArtStyleId}: ${body.error}`,
    );
    return NextResponse.json({ ok: true, error: body.error });
  }
  const description = (body.description || "").trim();
  if (description.length < 100) {
    return NextResponse.json(
      { error: "description (≥100 chars) required" },
      { status: 400 },
    );
  }
  const updated = await prisma.customArtStyle.update({
    where: { id: body.customArtStyleId },
    data: { description },
  });
  return NextResponse.json({ ok: true, customArtStyle: updated });
}

export const POST = handle;
export const PATCH = handle;
