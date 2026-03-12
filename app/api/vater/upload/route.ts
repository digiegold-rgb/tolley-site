import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const blob = await put(`vater/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  return NextResponse.json({ url: blob.url, pathname: blob.pathname });
}
