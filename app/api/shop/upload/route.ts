import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { validateShopAdmin } from "@/lib/shop-auth";

export async function POST(request: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type. Camera-roll picks on iOS sometimes give an empty
    // type — allow those through as long as the extension looks image-like.
    const looksLikeImage =
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name || "");
    if (!looksLikeImage) {
      return NextResponse.json(
        { error: `Only images allowed (got ${file.type || "unknown"})` },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (10MB max)` },
        { status: 400 }
      );
    }

    // Sanitize filename — iPhone HEIC filenames and names with spaces/parens
    // can produce awkward Blob URLs. Force a safe extension.
    const rawName = file.name || "upload";
    const extMatch = rawName.match(/\.(jpe?g|png|heic|heif|webp|gif)$/i);
    const ext = extMatch ? extMatch[0].toLowerCase() : ".jpg";
    const safeKey =
      `shop/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-img${ext}`;

    const blob = await put(safeKey, file, {
      access: "public",
      contentType: file.type || "image/jpeg",
      addRandomSuffix: false,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[shop/upload] error:", message, err);
    return NextResponse.json(
      { error: `Upload failed: ${message}` },
      { status: 500 }
    );
  }
}
