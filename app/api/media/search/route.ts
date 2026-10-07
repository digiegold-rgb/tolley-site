import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-auth";
import { logMediaWorkerFailure, searchYouTube } from "@/lib/media-worker";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q) {
    return NextResponse.json(
      { error: "q parameter required" },
      { status: 400 },
    );
  }

  try {
    const data = await searchYouTube(q);
    return NextResponse.json(data);
  } catch (err) {
    const { error } = logMediaWorkerFailure("search", err);
    return NextResponse.json({ error }, { status: 502 });
  }
}
