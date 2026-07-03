import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { postOne, type Platform, type PostInput } from "@/lib/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // YouTube uploads can run long

const VALID: Set<Platform> = new Set([
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "pinterest",
  "backatyou",
]);

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    platforms?: string[];
  };
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const post = await prisma.socialPost.findUnique({ where: { id: body.id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Mark as posting up front so the dashboard reflects it immediately.
  await prisma.socialPost.update({
    where: { id: post.id },
    data: { status: "posting", errorMessage: null },
  });

  const targets = (body.platforms ?? post.platforms).filter((p): p is Platform =>
    VALID.has(p as Platform),
  );
  const existingExternals: Record<string, string> = {
    ...((post.externalIds as Record<string, string>) ?? {}),
  };

  const input: PostInput = {
    id: post.id,
    mediaUrl: post.mediaUrl,
    mediaType: post.mediaType as PostInput["mediaType"],
    thumbnailUrl: post.thumbnailUrl,
    title: post.title,
    caption: post.caption,
    hashtags: post.hashtags,
  };

  const errors: string[] = [];
  let successCount = 0;

  for (const platform of targets) {
    // Skip platforms we already successfully posted to.
    if (existingExternals[platform]?.startsWith("http")) {
      successCount += 1;
      continue;
    }
    const result = await postOne(platform, input);
    if (result.ok) {
      existingExternals[platform] = result.url || result.externalId;
      successCount += 1;
    } else {
      existingExternals[platform] = `ERROR: ${result.error}`;
      errors.push(`${platform}: ${result.error}`);
    }
  }

  const allOk = errors.length === 0 && successCount === targets.length;
  await prisma.socialPost.update({
    where: { id: post.id },
    data: {
      status: allOk ? "posted" : successCount > 0 ? "posted" : "failed",
      postedAt: successCount > 0 ? new Date() : null,
      externalIds: existingExternals,
      errorMessage: errors.length > 0 ? errors.join(" | ") : null,
      retryCount: { increment: 1 },
    },
  });

  return NextResponse.json({
    id: post.id,
    successCount,
    failureCount: errors.length,
    externalIds: existingExternals,
    errors,
  });
}
