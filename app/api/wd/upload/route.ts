import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { validateWdAdmin } from "@/lib/wd-auth";

export async function POST(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) || "photo";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only images allowed" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (10MB max)" }, { status: 400 });
    }

    const folder = type === "receipt" ? "receipts" : "photos";
    const blob = await put(`wd/${folder}/${Date.now()}-${file.name}`, file, {
      access: "public",
    });

    return NextResponse.json({ url: blob.url, type });
  } catch (err) {
    console.error("WD upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
