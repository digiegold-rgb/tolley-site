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

// Action-cam /social renditions build in the background on the DGX; while one
// is cold, action-api serves the RAW 4K original as a fallback. Buffering that
// (800MB+) kills this function mid-run and strands the row in "posting"
// (7/15). The X-Social-Rendition header says what a fetch would actually get.
async function actionRenditionBlocker(mediaUrl: string): Promise<string | null> {
  if (!mediaUrl.startsWith("https://action-api.tolley.io/social?")) return null;
  try {
    const res = await fetch(mediaUrl, {
      headers: { Range: "bytes=0-1" },
      signal: AbortSignal.timeout(20_000),
    });
    void res.body?.cancel().catch(() => {});
    if (res.headers.get("x-social-rendition") === "raw") {
      return "Publish rendition is still building on action-api (raw original would be served) — wait ~2 minutes and Retry";
    }
  } catch {
    // Readiness check is best-effort; let the platform legs surface real errors.
  }
  return null;
}

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
    source: post.source,
    mediaUrl: post.mediaUrl,
    mediaType: post.mediaType as PostInput["mediaType"],
    thumbnailUrl: post.thumbnailUrl,
    title: post.title,
    caption: post.caption,
    hashtags: post.hashtags,
  };

  const blocker = await actionRenditionBlocker(post.mediaUrl);
  if (blocker) {
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { status: "failed", errorMessage: blocker },
    });
    return NextResponse.json(
      { id: post.id, successCount: 0, failureCount: targets.length, errors: [blocker] },
      { status: 409 },
    );
  }

  const errors: string[] = [];
  let successCount = 0;

  for (const platform of targets) {
    // Skip platforms we already successfully posted to.
    if (existingExternals[platform]?.startsWith("http")) {
      successCount += 1;
      continue;
    }
    let result: Awaited<ReturnType<typeof postOne>>;
    try {
      result = await postOne(platform, input);
    } catch (err) {
      result = {
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 300) : "unexpected error",
      };
    }
    if (result.ok) {
      existingExternals[platform] = result.url || result.externalId;
      successCount += 1;
    } else {
      existingExternals[platform] = `ERROR: ${result.error}`;
      errors.push(`${platform}: ${result.error}`);
    }
    // Persist after every platform so a mid-run kill can't lose finished legs
    // and Retry only re-fires what actually failed.
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { externalIds: existingExternals },
    });
  }

  const allOk = errors.length === 0 && successCount === targets.length;
  await prisma.socialPost.update({
    where: { id: post.id },
    data: {
      // Partial success must stay "failed" — "posted" hides the Retry button
      // and the failed legs (ERROR: externalIds) become unreachable in the UI.
      status: allOk ? "posted" : "failed",
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
