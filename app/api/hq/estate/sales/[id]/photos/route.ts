import { NextRequest, NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/hq/estate/sales/[id]/photos — multipart upload → Vercel Blob
 * `estate/<slug>/…`, appended to the sale's gallery. Upload only
 * EXIF-stripped images (the DGX photo pipeline strips; phone camera-roll
 * originals carry GPS).
 *
 * NOTE: adding the first photos to an upcoming sale arms the announcement
 * email on the next hourly cron — that's the designed approval step.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sale = await prisma.estateSale.findUnique({ where: { id } });
  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

  try {
    const formData = await request.formData();
    const files = formData.getAll("file").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const urls: string[] = [];
    for (const file of files) {
      const looksLikeImage =
        file.type.startsWith("image/") ||
        /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name || "");
      if (!looksLikeImage) {
        return NextResponse.json(
          { error: `Only images allowed (got ${file.type || file.name || "unknown"})` },
          { status: 400 },
        );
      }
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (10MB max)` },
          { status: 400 },
        );
      }
      const rawName = file.name || "upload";
      const extMatch = rawName.match(/\.(jpe?g|png|heic|heif|webp|gif)$/i);
      const ext = extMatch ? extMatch[0].toLowerCase() : ".jpg";
      const safeKey = `estate/${sale.slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const blob = await put(safeKey, file, {
        access: "public",
        contentType: file.type || "image/jpeg",
        addRandomSuffix: false,
      });
      urls.push(blob.url);
    }

    const updated = await prisma.estateSale.update({
      where: { id },
      data: { photos: [...sale.photos, ...urls], photosUpdatedAt: new Date() },
    });
    return NextResponse.json({ ok: true, added: urls, photos: updated.photos });
  } catch (err) {
    console.error("[hq/estate/photos POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}

/** DELETE — body { url } removes a photo from the gallery (blob delete best-effort). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sale = await prisma.estateSale.findUnique({ where: { id } });
  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url : "";
  if (!sale.photos.includes(url)) {
    return NextResponse.json({ error: "Photo not on this sale" }, { status: 404 });
  }

  const updated = await prisma.estateSale.update({
    where: { id },
    data: {
      photos: sale.photos.filter((p) => p !== url),
      photosUpdatedAt: new Date(),
    },
  });
  await del(url).catch((err) => console.warn("[hq/estate/photos] blob del failed:", err));
  return NextResponse.json({ ok: true, photos: updated.photos });
}
