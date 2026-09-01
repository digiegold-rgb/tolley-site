/**
 * Server loaders for per-studio Socials and the dashboard overview.
 *
 * Always scoped to workspace userIds the login owns. Owner house HQ totals
 * stay on GET /api/vater/socials/house — this file never returns ads or
 * channel-wide view-counter sums.
 */
import "server-only";

import { prisma } from "@/lib/prisma";
import { isVaterOwnerUser } from "@/lib/admin-auth";
import { loadVideoViews } from "@/lib/hq-posts-read";
import {
  hasSocialsStatsTables,
  isMissingSchemaError,
} from "@/lib/vater/schema-probe";
import { getStylePreset } from "@/lib/vater/style-presets";
import { utcMidnight } from "@/lib/vater/socials/metrics";
import { jsonSafe } from "@/lib/vater/socials/json";
import {
  dripStageOf,
  matchHouseVideo,
  shapeStudioVideo,
  sortStudioVideos,
  studioEncouragement,
  studioHighlight,
  type HouseVideoMatchInput,
  type StudioDripStage,
  type StudioVideo,
} from "@/lib/vater/socials/studio-library";
import {
  listWorkspaces,
  sessionRootUserId,
  type WorkspaceRow,
} from "@/lib/vater/workspaces";

const PROJECT_SELECT = {
  id: true,
  userId: true,
  sourceTitle: true,
  publishTitle: true,
  topic: true,
  sourceUrl: true,
  status: true,
  thumbnailUrl: true,
  finalVideoUrl: true,
  scenesJson: true,
  completedAt: true,
  createdAt: true,
  publishedAt: true,
  youtubeVideoId: true,
  settingsJson: true,
  stylePreset: true,
  updatedAt: true,
  stepDetails: true,
} as const;

export type StudioProjectRow = {
  id: string;
  userId: string | null;
  sourceTitle: string | null;
  publishTitle: string | null;
  topic: string | null;
  sourceUrl: string | null;
  status: string;
  thumbnailUrl: string | null;
  finalVideoUrl: string | null;
  scenesJson: unknown;
  completedAt: Date | null;
  createdAt: Date;
  publishedAt: Date | null;
  youtubeVideoId: string | null;
  settingsJson: unknown;
  stylePreset: string | null;
  updatedAt: Date;
  stepDetails: unknown;
};

function n(v: bigint | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const x = typeof v === "bigint" ? Number(v) : v;
  return Number.isFinite(x) ? x : null;
}

export interface StudioChannelCard {
  platform: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  status: string | null;
  followers: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  impressions: number | null;
  reach: number | null;
  pulledAt: string | null;
  deltas: { followers: number | null; views: number | null };
}

export interface StudioPostRow {
  postId: string;
  projectId: string;
  title: string | null;
  caption: string | null;
  status: string;
  platforms: unknown;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  impressions: number | null;
  reach: number | null;
  pulledAt: string | null;
}

async function houseVideosForOwner(
  userId: string,
  email: string | null | undefined,
): Promise<HouseVideoMatchInput[]> {
  if (!(await isVaterOwnerUser(userId, email))) return [];
  try {
    const payload = await loadVideoViews();
    return payload.videos.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      views: v.views,
      url: v.url,
      channelLabel: v.channelLabel,
      platform: v.platform,
    }));
  } catch (err) {
    if (isMissingSchemaError(err)) return [];
    console.error("[socials/studio] house video match skipped", err);
    return [];
  }
}

async function dripByProject(userId: string, projectIds: string[]): Promise<Map<string, StudioDripStage>> {
  const out = new Map<string, StudioDripStage>();
  if (!projectIds.length) return out;
  try {
    const posts = await prisma.vaterSocialPost.findMany({
      where: { userId, projectId: { in: projectIds } },
      select: { projectId: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    for (const p of posts) {
      if (out.has(p.projectId)) continue;
      out.set(p.projectId, dripStageOf(p.status));
    }
  } catch (err) {
    if (!isMissingSchemaError(err)) throw err;
  }
  return out;
}

async function zernioByProject(
  userId: string,
  projectIds: string[],
): Promise<Map<string, { views: number | null; likes: number | null }>> {
  const out = new Map<string, { views: number | null; likes: number | null }>();
  if (!projectIds.length || !(await hasSocialsStatsTables())) return out;
  try {
    const rows = await prisma.socialPostStat.findMany({
      where: { post: { userId, projectId: { in: projectIds } } },
      orderBy: { day: "desc" },
      include: { post: { select: { projectId: true } } },
    });
    for (const row of rows) {
      const pid = row.post.projectId;
      if (out.has(pid)) continue;
      out.set(pid, { views: n(row.views), likes: n(row.likes) });
    }
  } catch (err) {
    if (!isMissingSchemaError(err)) throw err;
  }
  return out;
}

export async function loadZernioStats(
  userId: string,
  windowDays: number,
): Promise<{
  channels: StudioChannelCard[];
  posts: StudioPostRow[];
  collecting: boolean;
  connected: number;
}> {
  const connected = await prisma.socialAccount
    .count({ where: { userId, status: { not: "failed" } } })
    .catch(() => 0);

  if (!(await hasSocialsStatsTables())) {
    return { channels: [], posts: [], collecting: connected > 0, connected };
  }

  const today = utcMidnight();
  const from = new Date(today.getTime() - (windowDays - 1) * 86_400_000);
  const priorFrom = new Date(from.getTime() - windowDays * 86_400_000);

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
        },
      }),
      prisma.socialPostStat.findMany({
        where: { day: { gte: from }, post: { userId } },
        include: {
          post: {
            select: {
              id: true,
              projectId: true,
              caption: true,
              status: true,
              platforms: true,
              publishedAt: true,
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

    const channels: StudioChannelCard[] = [...byPlatform.entries()].map(([platform, rows]) => {
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
          where: { id: { in: projectIds }, userId },
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

    const posts: StudioPostRow[] = [...byPost.entries()].map(([postId, rows]) => {
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

    return {
      channels,
      posts,
      collecting: channels.length === 0 && connected > 0,
      connected,
    };
  } catch (err) {
    if (isMissingSchemaError(err)) {
      return { channels: [], posts: [], collecting: connected > 0, connected };
    }
    throw err;
  }
}

export async function loadStudioProjects(userId: string): Promise<StudioProjectRow[]> {
  return prisma.youTubeProject.findMany({
    where: { userId, projectType: "youtube" },
    select: PROJECT_SELECT,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function decorateStudioVideos(
  userId: string,
  rows: StudioProjectRow[],
  house: HouseVideoMatchInput[] = [],
): Promise<StudioVideo[]> {
  const ids = rows.map((r) => r.id);
  const [drip, zernio] = await Promise.all([
    dripByProject(userId, ids),
    zernioByProject(userId, ids),
  ]);
  const videos = rows.map((row) => {
    const zn = zernio.get(row.id);
    const matched = house.length ? matchHouseVideo(row, house) : null;
    const preset = getStylePreset(row.stylePreset ?? "cinematic");
    return shapeStudioVideo(row, {
      dripStage: drip.get(row.id) ?? null,
      views: zn?.views ?? null,
      likes: zn?.likes ?? null,
      house: matched,
      hasPresetSample: Boolean(preset?.sampleImageUrl),
    });
  });
  return sortStudioVideos(videos);
}

export async function loadStudioPayload(
  session: { user?: { id?: string | null; email?: string | null } | null; workspace?: { rootUserId: string } | null },
  windowDays: number,
) {
  const userId = session.user?.id ?? "";
  const [wsRow, stats, rows] = await Promise.all([
    userId
      ? prisma.vaterWorkspace
          .findUnique({
            where: { userId },
            select: { name: true, ownerUserId: true, userId: true },
          })
          .catch(() => null)
      : null,
    loadZernioStats(userId, windowDays),
    loadStudioProjects(userId),
  ]);
  const house = await houseVideosForOwner(userId, session.user?.email);
  const videos = await decorateStudioVideos(userId, rows, house);
  const name = wsRow?.name ?? "My Studio";
  const queueCount = videos.filter(
    (v) => v.dripStage === "queued" || v.dripStage === "scheduled" || v.dripStage === "publishing",
  ).length;
  return jsonSafe({
    workspace: {
      userId,
      name,
      isPrimary: !wsRow || wsRow.ownerUserId === wsRow.userId,
    },
    videos,
    channels: stats.channels,
    posts: stats.posts,
    collecting: stats.collecting,
    connectedAccounts: stats.connected,
    queueCount,
    encouragement: studioEncouragement(name, videos),
    highlight: studioHighlight(videos),
  });
}

export interface OverviewStudio {
  userId: string;
  name: string;
  isPrimary: boolean;
  active: boolean;
  videoCount: number;
  readyCount: number;
  postedCount: number;
  topViews: number | null;
  topTitle: string | null;
  videos: StudioVideo[];
}

export async function loadOverviewPayload(
  session: { user?: { id?: string | null; email?: string | null } | null; workspace?: { rootUserId: string } | null },
) {
  const activeId = session.user?.id ?? "";
  const email = session.user?.email;
  const rootUserId = await sessionRootUserId(session);
  let tabs: WorkspaceRow[] = [];
  try {
    tabs = rootUserId ? await listWorkspaces(rootUserId) : [];
  } catch {
    tabs = [];
  }
  if (!tabs.length && activeId) {
    tabs = [
      {
        id: activeId,
        ownerUserId: rootUserId || activeId,
        userId: activeId,
        name: "My Studio",
        sortOrder: 0,
        archivedAt: null,
        createdAt: new Date(),
      },
    ];
  }

  const userIds = tabs.map((t) => t.userId);
  const rows = userIds.length
    ? await prisma.youTubeProject.findMany({
        where: { userId: { in: userIds }, projectType: "youtube" },
        select: PROJECT_SELECT,
        orderBy: { createdAt: "desc" },
        take: 400,
      })
    : [];

  const byUser = new Map<string, StudioProjectRow[]>();
  for (const row of rows) {
    if (!row.userId) continue;
    const list = byUser.get(row.userId) ?? [];
    list.push(row);
    byUser.set(row.userId, list);
  }

  const house = await houseVideosForOwner(activeId, email);
  const workspaces: OverviewStudio[] = [];
  for (const tab of tabs) {
    const mine = byUser.get(tab.userId) ?? [];
    const videos = await decorateStudioVideos(tab.userId, mine, house);
    const ready = videos.filter((v) => v.stage === "done" && v.finalVideoUrl);
    const posted = videos.filter((v) => v.posted);
    const top = videos.find((v) => v.views != null && v.views > 0) ?? ready[0] ?? videos[0];
    workspaces.push({
      userId: tab.userId,
      name: tab.name,
      isPrimary: tab.ownerUserId === tab.userId,
      active: tab.userId === activeId,
      videoCount: videos.length,
      readyCount: ready.length,
      postedCount: posted.length,
      topViews: top?.views ?? null,
      topTitle: top?.title ?? null,
      videos: videos.slice(0, 8),
    });
  }

  const allVideos = workspaces.flatMap((w) => w.videos);
  return jsonSafe({
    workspaces,
    totals: {
      videos: workspaces.reduce((s, w) => s + w.videoCount, 0),
      ready: workspaces.reduce((s, w) => s + w.readyCount, 0),
      posted: workspaces.reduce((s, w) => s + w.postedCount, 0),
    },
    encouragement:
      workspaces.length > 1
        ? studioEncouragement("Your studios", allVideos)
        : studioEncouragement(workspaces[0]?.name ?? "Your studio", allVideos),
    highlight: studioHighlight(allVideos),
  });
}
