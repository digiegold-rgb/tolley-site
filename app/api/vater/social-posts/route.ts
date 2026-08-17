/**
 * GET /api/vater/social-posts?limit=50&projectId=…
 *
 * The caller's own aggregator publishes (VaterSocialPost). Non-terminal rows
 * (scheduled / publishing) are refreshed from the vendor on read so the
 * Publishing screen's pending / posted / failed pills are truthful even
 * before a webhook lands.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getPost,
  isZernioEnabled,
  summarizePost,
} from "@/lib/vater/social-vendor/zernio";

const LIVE = new Set(["draft", "scheduled", "publishing", "queued", "pending"]);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") ?? 50) || 50));
  const projectId = sp.get("projectId") || undefined;

  const rows = await prisma.vaterSocialPost.findMany({
    where: { userId: session.user.id, ...(projectId ? { projectId } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Refresh up to 10 live rows per read; cheap and keeps the pills honest.
  if (isZernioEnabled()) {
    const live = rows.filter((r) => LIVE.has(r.status)).slice(0, 10);
    await Promise.all(
      live.map(async (r) => {
        try {
          const p = await getPost(r.externalPostId);
          const s = summarizePost(p);
          const updated = await prisma.vaterSocialPost.update({
            where: { id: r.id },
            data: {
              status: s.status,
              platforms: s.platforms,
              publishedAt: s.publishedAt,
              scheduledFor: s.scheduledFor,
              lastError: s.lastError,
            },
          });
          Object.assign(r, updated);
        } catch {
          /* leave the stored state; next read retries */
        }
      }),
    );
  }

  const counts = { pending: 0, posted: 0, failed: 0 };
  for (const r of rows) {
    if (r.status === "published") counts.posted += 1;
    else if (r.status === "failed" || r.status === "partial" || r.status === "cancelled") counts.failed += 1;
    else counts.pending += 1;
  }
  return NextResponse.json({ posts: rows, counts });
}
