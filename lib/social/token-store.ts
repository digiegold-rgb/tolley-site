import { prisma } from "@/lib/prisma";

/**
 * DB-backed token store for the Social Suite's own platform credentials.
 *
 * Vercel env vars can't be written at runtime, so every OAuth re-auth used to
 * mean copy-paste-into-vercel + redeploy — painful when Google expires refresh
 * tokens weekly (OAuth app in "Testing" mode). Tokens saved here by the
 * /api/social/oauth/* callbacks win over env vars; env remains the fallback so
 * nothing breaks if the row is missing.
 *
 * Reuses the PlatformConnection table with a reserved subscriberId — the
 * table's real users are /leads/content subscribers with their own ids.
 */
const ADMIN_SUBSCRIBER = "social-suite";

/**
 * Every active connection for a platform, newest first.
 *
 * getStoredToken() returns only the most recently updated row, which is right
 * for posting (one "current" account) but wrong for reporting: after the
 * @yourkchomes cutover there are two live YouTube channels, and reading just
 * the newest silently dropped the legacy channel's stats off /hq. Readers that
 * need per-channel accuracy iterate this instead.
 */
export async function getStoredTokens(
  platform: string,
): Promise<Array<{ accessToken: string; refreshToken: string | null; accountId: string | null; username: string | null }>> {
  try {
    const rows = await prisma.platformConnection.findMany({
      where: { subscriberId: ADMIN_SUBSCRIBER, platform, status: "active" },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((r) => ({
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      accountId: r.platformAccountId,
      username: r.platformUsername,
    }));
  } catch {
    return [];
  }
}

export async function getStoredToken(
  platform: string,
): Promise<{ accessToken: string; refreshToken: string | null; accountId: string | null } | null> {
  try {
    const row = await prisma.platformConnection.findFirst({
      where: { subscriberId: ADMIN_SUBSCRIBER, platform, status: "active" },
      orderBy: { updatedAt: "desc" },
    });
    if (!row) return null;
    return {
      accessToken: row.accessToken,
      refreshToken: row.refreshToken,
      accountId: row.platformAccountId,
    };
  } catch {
    return null; // never let a store hiccup break a post — env fallback covers it
  }
}

export async function saveStoredToken(platform: string, data: {
  accessToken: string;
  refreshToken?: string | null;
  accountId: string;
  username?: string;
  scopes?: string[];
  pageId?: string;
  pageName?: string;
}): Promise<void> {
  await prisma.platformConnection.upsert({
    where: {
      subscriberId_platform_platformAccountId: {
        subscriberId: ADMIN_SUBSCRIBER,
        platform,
        platformAccountId: data.accountId,
      },
    },
    create: {
      subscriberId: ADMIN_SUBSCRIBER,
      platform,
      platformAccountId: data.accountId,
      platformUsername: data.username,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? null,
      scopes: data.scopes ?? [],
      pageId: data.pageId,
      pageName: data.pageName,
      status: "active",
      lastError: null,
    },
    update: {
      platformUsername: data.username,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? null,
      scopes: data.scopes ?? [],
      pageId: data.pageId,
      pageName: data.pageName,
      status: "active",
      lastError: null,
    },
  });
}
