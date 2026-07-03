import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual upload",
  shop: "Shop product",
  realestate: "Real estate listing",
  vater: "Vater render",
};

export async function GET() {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

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
