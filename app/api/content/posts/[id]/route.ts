import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET/PUT/DELETE /api/content/posts/[id]
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth =
    req.headers.get("x-sync-secret") ||
    req.nextUrl.searchParams.get("key");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const post = await prisma.contentPost.findUnique({ where: { id } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ post });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth = req.headers.get("x-sync-secret");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  // Only allow editing draft/scheduled posts
  const existing = await prisma.contentPost.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status === "published" || existing.status === "publishing") {
    return NextResponse.json({ error: "Cannot edit published posts" }, { status: 400 });
  }

  const post = await prisma.contentPost.update({
    where: { id },
    data: {
      ...(body.postBody !== undefined && { body: body.postBody }),
      ...(body.platform !== undefined && { platform: body.platform }),
      ...(body.contentType !== undefined && { contentType: body.contentType }),
      ...(body.mediaUrls !== undefined && { mediaUrls: body.mediaUrls }),
      ...(body.hashtags !== undefined && { hashtags: body.hashtags }),
      ...(body.scheduledAt !== undefined && {
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        status: body.scheduledAt ? "scheduled" : "draft",
      }),
    },
  });

  return NextResponse.json({ post });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth = req.headers.get("x-sync-secret");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // If published, try to delete from platform too
  const post = await prisma.contentPost.findUnique({ where: { id } });
  if (post?.status === "published" && post.platformPostId) {
    // Best-effort platform deletion — don't block local delete
    try {
      const { getAdapter } = await import("@/lib/content/platforms");
      const adapter = getAdapter(post.platform as import("@/lib/content/types").PlatformType);
      if (adapter) {
        const conn = await prisma.platformConnection.findFirst({
          where: { subscriberId: post.subscriberId, platform: post.platform, status: "active" },
        });
        if (conn) {
          await adapter.deletePost(post.platformPostId, {
            accessToken: conn.accessToken,
            platformAccountId: conn.platformAccountId,
          });
        }
      }
    } catch {
      // silent — local delete proceeds regardless
    }
  }

  await prisma.contentPost.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
