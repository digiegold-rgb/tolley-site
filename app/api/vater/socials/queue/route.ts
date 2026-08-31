/**
 * GET /api/vater/socials/queue
 *
 * Upcoming scheduled/publishing posts for this tenant (tab = session.user.id).
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/vater/socials/json";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const posts = await prisma.vaterSocialPost.findMany({
    where: {
      userId: session.user.id,
      status: { in: ["scheduled", "publishing"] },
      scheduledFor: { gte: now },
    },
    orderBy: { scheduledFor: "asc" },
  });
  return NextResponse.json(jsonSafe({ posts }));
}
