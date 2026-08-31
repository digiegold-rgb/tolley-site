/**
 * DELETE /api/vater/socials/queue/[id]
 *
 * Cancel a scheduled post. userId must match the session (tab). Vendor
 * delete is best-effort — a 404 is treated as already gone.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deletePost, ZernioError } from "@/lib/vater/social-vendor/zernio";
import { jsonSafe } from "@/lib/vater/socials/json";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const row = await prisma.vaterSocialPost.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    await deletePost(row.externalPostId);
  } catch (err) {
    if (!(err instanceof ZernioError && err.status === 404)) {
      console.warn(
        "[socials/queue] vendor delete:",
        err instanceof ZernioError ? err.body.slice(0, 200) : err,
      );
    }
  }
  const updated = await prisma.vaterSocialPost.update({
    where: { id: row.id },
    data: { status: "cancelled" },
  });
  return NextResponse.json(jsonSafe({ post: updated }));
}
