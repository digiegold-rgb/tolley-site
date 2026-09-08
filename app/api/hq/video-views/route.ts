import { NextRequest, NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";
import { loadVideoViews } from "@/lib/hq-posts-read";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hq/video-views — every individual video the collector tracks, newest
// first, with its own view count. The view-counter cards answer "how is the
// channel doing"; this answers "which video worked", which is the only question
// that changes what gets made next.
//
// Facebook is the reason this exists: Meta's page_video_views metric doesn't
// count Reels-feed distribution, so a reels-first Page looks nearly dead in
// Page insights while its reels quietly rack up hundreds of views each. The
// per-video counts (collect.mjs → collectFbVideos) are the real number.

export async function GET(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  const sync = request.headers.get("x-sync-secret");
  if (!authed && !(sync && process.env.SYNC_SECRET && secretEquals(sync, process.env.SYNC_SECRET))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await loadVideoViews());
  } catch (err) {
    console.error("[hq/video-views GET]", err);
    return NextResponse.json({ error: "Failed to load video views" }, { status: 500 });
  }
}
