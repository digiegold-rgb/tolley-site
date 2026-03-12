import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdapter } from "@/lib/content/platforms";
import type { PlatformType } from "@/lib/content/types";

/**
 * POST /api/content/posts/[id]/publish
 * Immediately publish a draft/scheduled post.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth = req.headers.get("x-sync-secret");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const post = await prisma.contentPost.findUnique({ where: { id } });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.status === "published") {
    return NextResponse.json({ error: "Already published" }, { status: 400 });
  }

  // Get platform connection
  const connection = await prisma.platformConnection.findFirst({
    where: {
      subscriberId: post.subscriberId,
      platform: post.platform,
      status: "active",
    },
  });

  if (!connection) {
    return NextResponse.json(
      { error: `No active ${post.platform} connection. Connect the platform first.` },
      { status: 400 }
    );
  }

  const adapter = getAdapter(post.platform as PlatformType);
  if (!adapter) {
    return NextResponse.json(
      { error: `No adapter for platform: ${post.platform}` },
      { status: 400 }
    );
  }

  // Mark as publishing
  await prisma.contentPost.update({
    where: { id },
    data: { status: "publishing" },
  });

  try {
    const result = await adapter.publishPost(
      {
        body: post.body,
        mediaUrls: post.mediaUrls,
        hashtags: post.hashtags,
        contentType: post.contentType as "text" | "image" | "carousel" | "video" | "reel",
      },
      {
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken || undefined,
        expiresAt: connection.tokenExpiresAt || undefined,
        platformAccountId: connection.platformAccountId,
        pageId: connection.pageId || undefined,
      }
    );

    const updated = await prisma.contentPost.update({
      where: { id },
      data: {
        status: "published",
        publishedAt: new Date(),
        platformPostId: result.platformPostId,
        platformUrl: result.platformUrl,
      },
    });

    // Increment campaign counter
    if (post.campaignId) {
      await prisma.contentCampaign.update({
        where: { id: post.campaignId },
        data: { postsPublished: { increment: 1 } },
      });
    }

    return NextResponse.json({ post: updated });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Publish failed";
    await prisma.contentPost.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage: errorMsg.slice(0, 500),
        retryCount: { increment: 1 },
      },
    });

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
