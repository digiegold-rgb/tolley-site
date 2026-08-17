/**
 * GET /api/vater/social-accounts/[platform]/options
 *
 * Per-platform publish options that only the vendor knows for THIS user's
 * connected account:
 *   pinterest → boards (a pin needs a boardId)
 *   tiktok    → creator info (allowed privacy levels, daily posting limit)
 * Everything else → {} (nothing to choose).
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getTikTokCreatorInfo,
  listPinterestBoards,
  VENDOR,
  ZernioError,
} from "@/lib/vater/social-vendor/zernio";

type Ctx = { params: Promise<{ platform: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { platform } = await ctx.params;
  const row = await prisma.socialAccount.findUnique({
    where: { userId_platform: { userId: session.user.id, platform } },
    select: { provider: true, externalAccountId: true },
  });
  if (!row || row.provider !== VENDOR || !row.externalAccountId) {
    return NextResponse.json({});
  }
  try {
    if (platform === "pinterest") {
      const boards = await listPinterestBoards(row.externalAccountId);
      return NextResponse.json({ boards });
    }
    if (platform === "tiktok") {
      const info = await getTikTokCreatorInfo(row.externalAccountId);
      const privacyLevels =
        info.privacyLevels ?? info.privacy_level_options ?? [];
      return NextResponse.json({
        privacyLevels,
        postingLimits: info.postingLimits ?? null,
        creator: info.creatorNickname ?? info.creatorUsername ?? null,
      });
    }
    return NextResponse.json({});
  } catch (err) {
    const detail =
      err instanceof ZernioError ? err.body.slice(0, 300) : String(err);
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
