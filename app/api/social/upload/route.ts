import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PLATFORMS = new Set([
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "pinterest",
  "backatyou",
]);

interface CreateBody {
  mediaUrl: string;
  mediaType?: "video" | "image" | "carousel";
  thumbnailUrl?: string;
  title?: string;
  caption?: string;
  hashtags?: string[];
  platforms: string[];
  scheduledAt?: string;
  source?: "manual" | "shop" | "realestate" | "vater" | "action";
  sourceRefId?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!body.mediaUrl || typeof body.mediaUrl !== "string") {
    return NextResponse.json({ error: "mediaUrl required" }, { status: 400 });
  }
  if (!Array.isArray(body.platforms) || body.platforms.length === 0) {
    return NextResponse.json({ error: "platforms[] required" }, { status: 400 });
  }
  const platforms = body.platforms.filter((p) => VALID_PLATFORMS.has(p));
  if (platforms.length === 0) {
    return NextResponse.json({ error: "No valid platforms" }, { status: 400 });
  }

  const post = await prisma.socialPost.create({
    data: {
      source: body.source ?? "manual",
      sourceRefId: body.sourceRefId,
      mediaUrl: body.mediaUrl,
      mediaType: body.mediaType ?? "video",
      thumbnailUrl: body.thumbnailUrl,
      title: body.title,
      caption: body.caption ?? "",
      hashtags: Array.isArray(body.hashtags) ? body.hashtags : [],
      platforms,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      status: "ready",
    },
  });

  return NextResponse.json({ id: post.id, status: post.status });
}
