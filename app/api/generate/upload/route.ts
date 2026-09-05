import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { requireGenerateAdmin } from "@/lib/generate-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/bmp"]);

/**
 * POST /api/generate/upload — HQ/admin-gated still → public HTTPS Blob URL
 * for fal Wan I2V (source or optional last-frame / pose still).
 */
export async function POST(req: Request) {
  const gate = await requireGenerateAdmin();
  if (!gate.ok) return gate.response;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!IMAGE_TYPES.has(file.type) && !/\.(jpe?g|png|webp|bmp)$/i.test(file.name)) {
    return NextResponse.json({ error: "Only JPEG / PNG / WEBP stills" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (12MB max)" }, { status: 400 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Blob storage is not configured. Set BLOB_READ_WRITE_TOKEN or paste an HTTPS URL." },
      { status: 503 },
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeExt = ["jpg", "jpeg", "png", "webp", "bmp"].includes(ext) ? ext : "png";
  const blob = await put(`generate/motion/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`, file, {
    access: "public",
    contentType: file.type || `image/${safeExt === "jpg" ? "jpeg" : safeExt}`,
    addRandomSuffix: true,
  });
  return NextResponse.json({ url: blob.url });
}
