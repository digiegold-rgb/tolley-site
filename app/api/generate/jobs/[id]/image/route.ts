import { NextRequest, NextResponse } from "next/server";

import { requireGenerateAdmin } from "@/lib/generate-auth";
import { parseJobImageIndex } from "@/lib/generate-output";
import { fetchStoredJobImage } from "@/lib/generate-output-persist";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/generate/jobs/:id/image?i=0
 *
 * HQ/admin-gated still delivery. Studio/gallery must use this route — never a
 * public Vercel Blob CDN URL.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const gate = await requireGenerateAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const index = parseJobImageIndex(req.nextUrl.searchParams.get("i"));
  if (index == null) {
    return NextResponse.json({ error: "i query (image index) required" }, { status: 400 });
  }

  const row = await prisma.generateJob.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stored = row.outputUrls[index];
  if (!stored) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const image = await fetchStoredJobImage(id, stored);
    const body = Buffer.isBuffer(image.body) ? new Uint8Array(image.body) : image.body;
    return new NextResponse(body, {
      headers: {
        "Content-Type": image.contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 502 });
  }
}
