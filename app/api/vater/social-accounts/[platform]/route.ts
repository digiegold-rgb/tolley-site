/**
 * DELETE /api/vater/social-accounts/[platform]
 *
 * Disconnect a single social platform for the current user. The underlying
 * token isn't revoked on the provider side — user can revoke there if they
 * want a clean break. We just forget the credentials locally.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SUPPORTED_PLATFORMS } from "@/lib/vater-social";

type Ctx = { params: Promise<{ platform: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { platform } = await ctx.params;
  if (!(SUPPORTED_PLATFORMS as readonly string[]).includes(platform)) {
    return NextResponse.json({ error: "Unknown platform" }, { status: 400 });
  }

  await prisma.socialAccount.deleteMany({
    where: { userId: session.user.id, platform },
  });

  return NextResponse.json({ ok: true });
}
