import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual upload",
  shop: "Shop product",
  realestate: "Real estate listing",
  vater: "Vater render",
  launchpad: "Launchpad storefront",
  action: "🎥 Action Cam",
};

export async function GET() {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  // Heal rows stranded in "posting": if the post function was killed
  // (timeout/OOM) before its final status write, nothing else ever flips the
  // row. maxDuration is 300s and the post loop touches updatedAt after every
  // platform, so 10 minutes stale = the run is dead. Flip to failed so the
  // Retry button reappears.
  const staleCutoff = new Date(Date.now() - 10 * 60 * 1000);
  await prisma.socialPost.updateMany({
    where: { status: "posting", updatedAt: { lt: staleCutoff } },
    data: {
      status: "failed",
      errorMessage:
        "Posting run was killed before finishing (function timeout) — Retry re-fires the unfinished platforms",
    },
  });

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await prisma.socialPost.findMany({
    where: {
      OR: [
        { createdAt: { gte: since } },
        { status: { in: ["ready", "posting", "draft"] } },
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });

  const items = rows.map((row) => ({
    id: row.id,
    source: row.source,
    sourceLabel: SOURCE_LABEL[row.source] ?? row.source,
    mediaUrl: row.mediaUrl,
    thumbnailUrl: row.thumbnailUrl,
    title: row.title,
    caption: row.caption,
    hashtags: row.hashtags,
    platforms: row.platforms,
    scheduledAt: row.scheduledAt?.toISOString(),
    postedAt: row.postedAt?.toISOString(),
    status: row.status,
    externalIds: (row.externalIds ?? {}) as Record<string, string>,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
  }));

  return NextResponse.json({ items });
}
