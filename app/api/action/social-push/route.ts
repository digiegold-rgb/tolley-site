import { NextRequest, NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";
import { prisma } from "@/lib/prisma";
import { generateCaption, type CaptionPlatform } from "@/lib/social/captions";

// Bridge between /action and the Social Suite. The /action dashboard is behind
// the shop-admin PIN gate (not the NextAuth admin session the /api/social/*
// routes require), so it gets its own PIN-gated route: draft a caption, or
// enqueue an action-cam video as a SocialPost. Enqueue only — nothing posts
// until "Post now" is clicked on /social.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const VALID_PLATFORMS = new Set([
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "pinterest",
  "backatyou",
]);
const CAPTION_PLATFORMS = new Set<CaptionPlatform>([
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "pinterest",
]);
// Only videos served by the action-cam API can be queued through this route.
const MEDIA_PREFIX = "https://action-api.tolley.io/";

type Body = {
  op: "caption" | "queue";
  // caption
  platforms?: string[];
  topic?: string;
  hint?: string;
  // queue
  mediaUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  caption?: string;
  hashtags?: string[];
  sourceRefId?: string;
};

export async function POST(request: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (body.op === "caption") {
    const platforms = (body.platforms ?? []).filter((p): p is CaptionPlatform =>
      CAPTION_PLATFORMS.has(p as CaptionPlatform),
    );
    try {
      const result = await generateCaption({ platforms, hint: body.hint, topic: body.topic });
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "caption gen failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (body.op === "queue") {
    if (!body.mediaUrl || !body.mediaUrl.startsWith(MEDIA_PREFIX)) {
      return NextResponse.json({ error: "mediaUrl must be an action-api.tolley.io URL" }, { status: 400 });
    }
    const platforms = (body.platforms ?? []).filter((p) => VALID_PLATFORMS.has(p));
    if (platforms.length === 0) {
      return NextResponse.json({ error: "platforms[] required" }, { status: 400 });
    }
    const post = await prisma.socialPost.create({
      data: {
        source: "action",
        sourceRefId: body.sourceRefId,
        mediaUrl: body.mediaUrl,
        mediaType: "video",
        thumbnailUrl: body.thumbnailUrl?.startsWith(MEDIA_PREFIX) ? body.thumbnailUrl : undefined,
        title: body.title,
        caption: body.caption ?? "",
        hashtags: Array.isArray(body.hashtags) ? body.hashtags : [],
        platforms,
        status: "ready",
      },
    });
    return NextResponse.json({ id: post.id, status: post.status });
  }

  return NextResponse.json({ error: "op must be caption|queue" }, { status: 400 });
}
