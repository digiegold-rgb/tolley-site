/**
 * GET /api/vater/youtube/stats[?ids=VIDEOID,VIDEOID]
 *
 * Public counters (views / likes / comments) for videos this account
 * published, read with the user's own stored YouTube token.
 *
 * With no `ids`, it reports on every published project the caller can see —
 * that's what the Analytics screen wants. With `ids`, it reports on exactly
 * those, filtered to video ids that belong to the caller's projects, so this
 * can never be used to look up an arbitrary channel's numbers through our
 * credentials.
 *
 * A missing / expired YouTube connection is NOT an error here: the panel is
 * informational, so we answer 200 with `connected: false` and let it say
 * "connect YouTube to see views" instead of blowing up a screen that has
 * plenty else to show.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isVaterAdminEmail } from "@/lib/admin-auth";
import { getAccessToken } from "@/lib/vater/youtube-upload";
import {
  fetchYouTubeStats,
  type YouTubeVideoStats,
} from "@/lib/vater/youtube-status";

/** Cap the fan-out: 4 chunked videos.list calls is plenty for one panel. */
const MAX_IDS = 200;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Which published videos does this caller own? Admins see every project,
  // matching lib/vater/project-access.
  const mine = await prisma.youTubeProject.findMany({
    where: {
      youtubeVideoId: { not: null },
      ...(isVaterAdminEmail(session.user.email) ? {} : { userId }),
    },
    select: { id: true, youtubeVideoId: true },
    orderBy: { publishedAt: "desc" },
    take: MAX_IDS,
  });
  const owned = new Map<string, string>();
  for (const p of mine) {
    if (p.youtubeVideoId) owned.set(p.youtubeVideoId, p.id);
  }

  const requested = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Intersect with what they own — never proxy a lookup for someone else's id.
  const ids =
    requested.length > 0
      ? requested.filter((v) => owned.has(v))
      : [...owned.keys()];

  if (ids.length === 0) {
    return NextResponse.json({ connected: true, stats: {}, projectIds: {} });
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(userId);
  } catch (err) {
    return NextResponse.json({
      connected: false,
      stats: {},
      projectIds: {},
      detail: err instanceof Error ? err.message : "YouTube is not connected",
    });
  }

  let stats: Record<string, YouTubeVideoStats>;
  try {
    stats = await fetchYouTubeStats(ids, accessToken);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Could not read YouTube statistics",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }

  // videoId → projectId, so a caller holding project rows can join without a
  // second query.
  const projectIds: Record<string, string> = {};
  for (const videoId of Object.keys(stats)) {
    const projectId = owned.get(videoId);
    if (projectId) projectIds[videoId] = projectId;
  }

  return NextResponse.json({ connected: true, stats, projectIds });
}
