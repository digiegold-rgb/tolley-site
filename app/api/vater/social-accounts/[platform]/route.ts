/**
 * DELETE /api/vater/social-accounts/[platform]
 *
 * Disconnect a single social platform for the current user.
 *  - native rows (YouTube): forget the token locally; the user can revoke on
 *    Google's side for a clean break.
 *  - vendor rows (Zernio): also DELETE the account at the vendor so it stops
 *    billing as a connected account.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SUPPORTED_PLATFORMS } from "@/lib/vater-social";
import { deleteAccount, VENDOR, ZernioError } from "@/lib/vater/social-vendor/zernio";

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

  const row = await prisma.socialAccount.findUnique({
    where: { userId_platform: { userId: session.user.id, platform } },
    select: { provider: true, externalAccountId: true },
  });
  let vendorWarning: string | null = null;
  if (row?.provider === VENDOR && row.externalAccountId) {
    try {
      await deleteAccount(row.externalAccountId);
    } catch (err) {
      // 404 = already gone at the vendor; anything else is worth surfacing
      // but must not block the local disconnect.
      if (!(err instanceof ZernioError && err.status === 404)) {
        vendorWarning =
          err instanceof ZernioError ? err.body.slice(0, 200) : String(err);
        console.warn(`[social/disconnect] vendor delete failed:`, vendorWarning);
      }
    }
  }

  await prisma.socialAccount.deleteMany({
    where: { userId: session.user.id, platform },
  });

  return NextResponse.json({ ok: true, ...(vendorWarning ? { vendorWarning } : {}) });
}
