/**
 * GET /api/cron/vater-rss-poll
 *
 * Vercel cron — runs every 15 minutes (see vercel.json).
 *
 * For every VaterRssFeed:
 *   1. Parse the feed via the local rss-parser wrapper.
 *   2. Upsert each item by (feedId, guid). Skip items older than feed.createdAt.
 *   3. For NEW items where feed.autoPipeline is true, create a YouTubeProject
 *      with sourceType="rss" + the feed's defaults, then call autopilot.fetchSource
 *      to kick off the transcribe pipeline.
 *   4. Update feed.lastPolledAt + feed.lastItemGuid.
 *
 * Auth: matches the existing cron pattern (Bearer CRON_SECRET or x-sync-secret).
 *
 * Errors are surfaced per feed in the response body. We never silently swallow.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isVaterAdminEmail } from "@/lib/admin-auth";
import { parseFeed, type FeedType } from "@/lib/vater/rss-parser";
import {
  autopilot,
  AutopilotError,
} from "@/lib/vater/autopilot-client";

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const sync = req.headers.get("x-sync-secret");
  if (sync && sync === process.env.SYNC_SECRET) return true;
  return false;
}

function isReadOnlyTransactionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /25006|read-only transaction/i.test(msg);
}

/** One retry — Neon can surface 25006 briefly during compute handoff. */
async function writeRetry<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    if (!isReadOnlyTransactionError(err)) throw err;
    return await op();
  }
}

interface PerFeedResult {
  feedId: string;
  feedUrl: string;
  newItems: number;
  promotedProjects: number;
  errors: string[];
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Feeds are per-user. Include the owner's email so autoPipeline (unattended
  // spend) can be restricted to vater-admin owners; everyone else's new items
  // are discovered here and promoted manually from the Feeds screen.
  const feeds = await prisma.vaterRssFeed.findMany({
    include: { user: { select: { id: true, email: true } } },
  });
  const results: PerFeedResult[] = [];

  for (const feed of feeds) {
    const r: PerFeedResult = {
      feedId: feed.id,
      feedUrl: feed.url,
      newItems: 0,
      promotedProjects: 0,
      errors: [],
    };

    try {
      const parsed = await parseFeed(feed.url, feed.feedType as FeedType);
      // Refresh feed title if it changed (and we have one)
      const titleChanged =
        parsed.title && parsed.title !== feed.title ? parsed.title : null;

      let lastSeenGuid: string | null = feed.lastItemGuid;

      for (const item of parsed.items) {
        // Skip items older than feed registration — first poll grabs nothing
        // and the feed only auto-pipelines NEW items going forward.
        if (item.publishedAt && item.publishedAt < feed.createdAt) {
          continue;
        }

        // Check existence first so we can tell brand-new from already-seen
        const existing = await prisma.vaterRssItem.findUnique({
          where: {
            feedId_guid: { feedId: feed.id, guid: item.guid },
          },
          select: { id: true, project: { select: { id: true } } },
        });

        let itemRow: { id: string; project: { id: string } | null };
        const isNew = !existing;

        if (existing) {
          // Refresh mutable display fields only
          await writeRetry(() =>
            prisma.vaterRssItem.update({
              where: { id: existing.id },
              data: {
                title: item.title,
                description: item.description,
                thumbnail: item.thumbnail,
              },
            }),
          );
          itemRow = existing;
        } else {
          const created = await writeRetry(() =>
            prisma.vaterRssItem.create({
              data: {
                feedId: feed.id,
                guid: item.guid,
                title: item.title,
                url: item.url,
                publishedAt: item.publishedAt,
                description: item.description,
                thumbnail: item.thumbnail,
              },
              select: { id: true },
            }),
          );
          itemRow = { id: created.id, project: null };
        }

        if (!isNew) continue;

        r.newItems += 1;
        lastSeenGuid = item.guid;

        // Auto-pipeline gate — owner-only (unattended spend).
        if (!feed.autoPipeline) continue;
        if (feed.userId && !isVaterAdminEmail(feed.user?.email)) continue;
        if (itemRow.project) continue; // already has a project
        if (!item.url) continue;

        try {
          const project = await writeRetry(() =>
            prisma.youTubeProject.create({
              data: {
                mode: "transcribe",
                userId: feed.userId ?? undefined,
                sourceUrl: item.url,
                sourceTitle: item.title,
                sourceType: "rss",
                rssItemId: itemRow.id,
                goal: feed.defaultGoal,
                targetDuration: feed.defaultWords
                  ? Math.max(1, Math.round(feed.defaultWords / 150))
                  : 10,
                targetWordCount: feed.defaultWords ?? 1500,
                stylePreset: feed.defaultStyle ?? "cinematic",
                voiceCloneId: feed.defaultVoiceId,
                status: "fetching",
              },
            }),
          );

          // Kick off the autopilot fetch-source job
          const job = await autopilot.fetchSource({
            projectId: project.id,
            sourceUrl: item.url,
          });

          await writeRetry(() =>
            prisma.youTubeProject.update({
              where: { id: project.id },
              data: { autopilotJobId: job.jobId, progress: 5 },
            }),
          );

          r.promotedProjects += 1;
        } catch (err) {
          if (err instanceof AutopilotError) {
            r.errors.push(
              `auto-pipeline ${item.guid}: ${err.status} ${err.body || err.message}`,
            );
          } else {
            r.errors.push(
              `auto-pipeline ${item.guid}: ${err instanceof Error ? err.message : "unknown"}`,
            );
          }
        }
      }

      await writeRetry(() =>
        prisma.vaterRssFeed.update({
          where: { id: feed.id },
          data: {
            lastPolledAt: new Date(),
            lastItemGuid: lastSeenGuid,
            errorMessage: null,
            ...(titleChanged ? { title: titleChanged } : {}),
          },
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      r.errors.push(`feed parse: ${msg}`);
      if (isReadOnlyTransactionError(err)) {
        r.errors.push(
          "feed update skipped: DATABASE_URL is not writable and this repo has no write URL configured",
        );
      } else {
        try {
          await writeRetry(() =>
            prisma.vaterRssFeed.update({
              where: { id: feed.id },
              data: { lastPolledAt: new Date(), errorMessage: msg.slice(0, 500) },
            }),
          );
        } catch (markErr) {
          if (!isReadOnlyTransactionError(markErr)) throw markErr;
          r.errors.push(
            "feed update skipped: DATABASE_URL is not writable and this repo has no write URL configured",
          );
        }
      }
    }

    results.push(r);
  }

  return NextResponse.json({
    ok: true,
    feedsChecked: feeds.length,
    totalNewItems: results.reduce((a, r) => a + r.newItems, 0),
    totalPromoted: results.reduce((a, r) => a + r.promotedProjects, 0),
    results,
  });
}
