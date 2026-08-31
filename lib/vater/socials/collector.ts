/**
 * lib/vater/socials/collector.ts
 *
 * Pull Zernio channel + post analytics into SocialChannelStat / SocialPostStat.
 * Every vendor call is try/caught so one bad account cannot lose the rest.
 * Tables may be missing (migration is hand-applied) — then we skip writes.
 *
 * Tenants: users with at least one SocialAccount provider=zernio, ordered by
 * least-recent SocialChannelStat.pulledAt (never-pulled first).
 */
import { prisma } from "@/lib/prisma";
import {
  hasSocialsStatsTables,
  isMissingSchemaError,
} from "@/lib/vater/schema-probe";
import {
  VENDOR,
  getChannelInsights,
  getFollowerStats,
  getPostAnalytics,
} from "@/lib/vater/social-vendor/zernio";
import {
  mergeMetrics,
  metricsToBigInt,
  parseMetrics,
  utcMidnight,
} from "./metrics";
import { flattenInsight, matchAnalyticsToPosts } from "./match";

export interface CollectSocialStatsResult {
  tenants: number;
  accounts: number;
  posts: number;
  skipped: number;
  errors: string[];
}

export interface CollectSocialStatsOpts {
  limit?: number;
  now?: Date;
}

export async function collectSocialStats(
  opts: CollectSocialStatsOpts = {},
): Promise<CollectSocialStatsResult> {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 25));
  const day = utcMidnight(opts.now ?? new Date());
  const result: CollectSocialStatsResult = {
    tenants: 0,
    accounts: 0,
    posts: 0,
    skipped: 0,
    errors: [],
  };

  if (!(await hasSocialsStatsTables())) {
    result.skipped += 1;
    result.errors.push("SocialChannelStat/SocialPostStat tables missing");
    return result;
  }

  let accountRows: Array<{
    userId: string;
    platform: string;
    externalAccountId: string | null;
  }>;
  try {
    accountRows = await prisma.socialAccount.findMany({
      where: { provider: VENDOR, externalAccountId: { not: null } },
      select: { userId: true, platform: true, externalAccountId: true },
    });
  } catch (err) {
    result.errors.push(`list accounts: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  const byUser = new Map<string, typeof accountRows>();
  for (const row of accountRows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row);
    byUser.set(row.userId, list);
  }
  if (byUser.size === 0) return result;

  let lastPull = new Map<string, Date>();
  try {
    const snaps = await prisma.socialChannelStat.groupBy({
      by: ["userId"],
      _max: { pulledAt: true },
    });
    lastPull = new Map(
      snaps
        .filter((s) => s._max.pulledAt)
        .map((s) => [s.userId, s._max.pulledAt as Date]),
    );
  } catch (err) {
    if (!isMissingSchemaError(err)) {
      result.errors.push(`groupBy pulledAt: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const tenants = [...byUser.keys()].sort((a, b) => {
    const ta = lastPull.get(a)?.getTime() ?? 0;
    const tb = lastPull.get(b)?.getTime() ?? 0;
    return ta - tb;
  }).slice(0, limit);

  result.tenants = tenants.length;

  for (const userId of tenants) {
    const accounts = byUser.get(userId) ?? [];
    for (const acc of accounts) {
      const accountId = acc.externalAccountId;
      if (!accountId) {
        result.skipped += 1;
        continue;
      }
      try {
        let insights: unknown = null;
        try {
          insights = await getChannelInsights(acc.platform, accountId);
        } catch (err) {
          result.errors.push(
            `${userId}/${acc.platform} insights: ${err instanceof Error ? err.message : String(err)}`.slice(0, 240),
          );
        }
        let followers: unknown = null;
        try {
          followers = await getFollowerStats(accountId);
        } catch (err) {
          result.errors.push(
            `${userId}/${acc.platform} followers: ${err instanceof Error ? err.message : String(err)}`.slice(0, 240),
          );
        }
        const metrics = mergeMetrics(flattenInsight(insights), parseMetrics(followers));
        const data = metricsToBigInt(metrics);
        await prisma.socialChannelStat.upsert({
          where: {
            userId_platform_day: { userId, platform: acc.platform, day },
          },
          create: {
            userId,
            platform: acc.platform,
            day,
            ...data,
          },
          update: {
            ...data,
            pulledAt: new Date(),
          },
        });
        result.accounts += 1;
      } catch (err) {
        if (isMissingSchemaError(err)) {
          result.skipped += 1;
          result.errors.push("SocialChannelStat missing mid-run");
          return result;
        }
        result.errors.push(
          `${userId}/${acc.platform}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 240),
        );
      }
    }

    try {
      let profileId: string | undefined;
      try {
        const profile = await prisma.vaterSocialProfile.findUnique({
          where: { userId },
          select: { externalProfileId: true },
        });
        profileId = profile?.externalProfileId ?? undefined;
      } catch {
        /* profile table optional — still pull analytics */
      }
      const rows = await getPostAnalytics(profileId ? { profileId } : {});
      if (!rows.length) continue;
      const posts = await prisma.vaterSocialPost.findMany({
        where: { userId },
        select: { id: true, externalPostId: true },
      });
      const hits = matchAnalyticsToPosts(rows, posts);
      result.skipped += Math.max(0, rows.length - hits.length);
      for (const hit of hits) {
        try {
          const data = metricsToBigInt(parseMetrics(hit.raw));
          await prisma.socialPostStat.upsert({
            where: { postId_day: { postId: hit.postId, day } },
            create: { postId: hit.postId, day, ...data },
            update: { ...data, pulledAt: new Date() },
          });
          result.posts += 1;
        } catch (err) {
          if (isMissingSchemaError(err)) {
            result.skipped += 1;
            continue;
          }
          result.errors.push(
            `post ${hit.postId}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 240),
          );
        }
      }
    } catch (err) {
      result.errors.push(
        `${userId} analytics: ${err instanceof Error ? err.message : String(err)}`.slice(0, 240),
      );
    }
  }

  return result;
}
