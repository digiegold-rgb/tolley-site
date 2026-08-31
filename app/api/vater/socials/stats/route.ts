/**
 * GET /api/vater/socials/stats?window=7|28|90
 *
 * Channel cards + deltas + per-post performance joined to VaterSocialPost
 * and YouTubeProject.sourceTitle. Session auth. BigInt → Number.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  hasSocialsStatsTables,
  isMissingSchemaError,
} from "@/lib/vater/schema-probe";
import { jsonSafe } from "@/lib/vater/socials/json";
import { utcMidnight } from "@/lib/vater/socials/metrics";

const WINDOWS = new Set([7, 28, 90]);

function n(v: bigint | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const x = typeof v === "bigint" ? Number(v) : v;
  return Number.isFinite(x) ? x : null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const raw = Number(req.nextUrl.searchParams.get("window") ?? 28);
  const windowDays = WINDOWS.has(raw) ? raw : 28;
  const userId = session.user.id;
  const today = utcMidnight();
  const from = new Date(today.getTime() - (windowDays - 1) * 86_400_000);
  const priorFrom = new Date(from.getTime() - windowDays * 86_400_000);

  if (!(await hasSocialsStatsTables())) {
    const connected = await prisma.socialAccount
      .count({ where: { userId } })
      .catch(() => 0);
    return NextResponse.json({
      window: windowDays,
      channels: [],
      posts: [],
      collecting: connected > 0,
    });
  }

  try {
    const [channelRows, accounts, postStats] = await Promise.all([
      prisma.socialChannelStat.findMany({
        where: { userId, day: { gte: priorFrom } },
        orderBy: { day: "asc" },
      }),
      prisma.socialAccount.findMany({
        where: { userId },
        select: {
          platform: true,
          displayName: true,
          username: true,
          avatarUrl: true,
          status: true,
          provider: true,
        },
      }),
      prisma.socialPostStat.findMany({
        where: {
          day: { gte: from },
          post: { userId },
        },
        include: {
          post: {
            select: {
              id: true,
              projectId: true,
              caption: true,
              status: true,
              platforms: true,
              publishedAt: true,
              scheduledFor: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    const byPlatform = new Map<string, typeof channelRows>();
    for (const row of channelRows) {
      const list = byPlatform.get(row.platform) ?? [];
      list.push(row);
      byPlatform.set(row.platform, list);
    }

    const channels = [...byPlatform.entries()].map(([platform, rows]) => {
      const inWindow = rows.filter((r) => r.day >= from);
      const prior = rows.filter((r) => r.day < from);
      const latest = inWindow[inWindow.length - 1] ?? rows[rows.length - 1];
      const first = inWindow[0] ?? latest;
      const priorLatest = prior[prior.length - 1];
      const followers = n(latest?.followers);
      const priorFollowers = n(priorLatest?.followers ?? first?.followers);
      const viewsNow = n(latest?.views);
      const viewsThen = n(priorLatest?.views ?? first?.views);
      const acc = accounts.find((a) => a.platform === platform);
      return {
        platform,
        displayName: acc?.displayName ?? null,
        username: acc?.username ?? null,
        avatarUrl: acc?.avatarUrl ?? null,
        status: acc?.status ?? null,
        followers,
        views: viewsNow,
        likes: n(latest?.likes),
        comments: n(latest?.comments),
        shares: n(latest?.shares),
        impressions: n(latest?.impressions),
        reach: n(latest?.reach),
        pulledAt: latest?.pulledAt?.toISOString() ?? null,
        deltas: {
          followers:
            followers !== null && priorFollowers !== null ? followers - priorFollowers : null,
          views: viewsNow !== null && viewsThen !== null ? viewsNow - viewsThen : null,
        },
      };
    });

    const projectIds = [...new Set(postStats.map((s) => s.post.projectId))];
    const projects = projectIds.length
      ? await prisma.youTubeProject.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, sourceTitle: true, publishTitle: true },
        })
      : [];
    const titleOf = new Map(
      projects.map((p) => [p.id, p.publishTitle || p.sourceTitle || null]),
    );

    const byPost = new Map<string, typeof postStats>();
    for (const s of postStats) {
      const list = byPost.get(s.postId) ?? [];
      list.push(s);
      byPost.set(s.postId, list);
    }

    const posts = [...byPost.entries()].map(([postId, rows]) => {
      const latest = rows[rows.length - 1];
      const p = latest.post;
      return {
        postId,
        projectId: p.projectId,
        title: titleOf.get(p.projectId) ?? p.caption ?? null,
        caption: p.caption,
        status: p.status,
        platforms: p.platforms,
        publishedAt: p.publishedAt?.toISOString() ?? null,
        views: n(latest.views),
        likes: n(latest.likes),
        comments: n(latest.comments),
        shares: n(latest.shares),
        impressions: n(latest.impressions),
        reach: n(latest.reach),
        pulledAt: latest.pulledAt.toISOString(),
      };
    });

    return NextResponse.json(
      jsonSafe({
        window: windowDays,
        channels,
        posts,
        collecting: channels.length === 0 && accounts.length > 0,
      }),
    );
  } catch (err) {
    if (isMissingSchemaError(err)) {
      const connected = await prisma.socialAccount
        .count({ where: { userId } })
        .catch(() => 0);
      return NextResponse.json({
        window: windowDays,
        channels: [],
        posts: [],
        collecting: connected > 0,
      });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "stats failed" },
      { status: 500 },
    );
  }
}
