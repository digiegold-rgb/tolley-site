import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-auth";
import { submitDownload, type MediaCategory } from "@/lib/media-worker";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url, category, title } = (await req.json()) as {
    url?: string;
    category?: MediaCategory;
    title?: string;
  };

  if (!url || !category) {
    return NextResponse.json(
      { error: "url and category are required" },
      { status: 400 },
    );
  }

  if (!["music", "music-video", "video"].includes(category)) {
    return NextResponse.json(
      { error: "category must be music, music-video, or video" },
      { status: 400 },
    );
  }

  try {
    const data = await submitDownload(url, category, title);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
