import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { put } from "@vercel/blob";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only images are allowed" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (10MB max)" }, { status: 400 });
  }

  try {
    const blob = await put(
      `video-source/${session.user.id}/${Date.now()}-${file.name}`,
      file,
      { access: "public" },
    );

    return NextResponse.json({ url: blob.url });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
