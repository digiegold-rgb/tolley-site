/**
 * Content Engine — Scheduler / cron logic.
 *
 * Follows the pattern from app/api/cron/sequence-process/route.ts:
 * - Batch processing with configurable batch size
 * - Token refresh for expiring connections
 * - Active hours enforcement
 */

import { prisma } from "@/lib/prisma";
import { getAdapter } from "./platforms";
import type { PlatformType } from "./types";

// ── Publish Due Posts ───────────────────────────────────────

export interface PublishBatchResult {
  processed: number;
  published: number;
  failed: number;
  skipped: number;
}

/**
 * Find and publish posts where scheduledAt <= now.
 * Called by /api/cron/content-publish every 5 minutes.
 */
export async function publishDuePosts(batchSize: number = 20): Promise<PublishBatchResult> {
  const now = new Date();
  let published = 0;
  let failed = 0;
  let skipped = 0;

  // Find scheduled posts that are due
  const duePosts = await prisma.contentPost.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: "asc" },
    take: batchSize,
  });

  if (duePosts.length === 0) {
    return { processed: 0, published: 0, failed: 0, skipped: 0 };
  }

  for (const post of duePosts) {
    try {
      // Mark as publishing
      await prisma.contentPost.update({
        where: { id: post.id },
        data: { status: "publishing" },
      });

      // Get platform connection
      const connection = await prisma.platformConnection.findFirst({
        where: {
          subscriberId: post.subscriberId,
          platform: post.platform,
          status: "active",
        },
      });

      if (!connection) {
        await prisma.contentPost.update({
          where: { id: post.id },
          data: {
            status: "failed",
            errorMessage: `No active ${post.platform} connection found`,
          },
        });
        failed++;
        continue;
      }

      // Check token expiry
      if (connection.tokenExpiresAt && connection.tokenExpiresAt <= now) {
        await prisma.contentPost.update({
          where: { id: post.id },
          data: {
            status: "failed",
            errorMessage: `${post.platform} token expired — reconnect platform`,
          },
        });
        failed++;
        continue;
      }

      // Get adapter and publish
      const adapter = getAdapter(post.platform as PlatformType);
      if (!adapter) {
        await prisma.contentPost.update({
          where: { id: post.id },
          data: {
            status: "failed",
            errorMessage: `No adapter for platform: ${post.platform}`,
          },
        });
        failed++;
        continue;
      }

      const result = await adapter.publishPost(
        {
          body: post.body,
          mediaUrls: post.mediaUrls,
          hashtags: post.hashtags,
          contentType: post.contentType as "text" | "image" | "carousel" | "video" | "reel",
        },
        {
          accessToken: connection.accessToken,
          refreshToken: connection.refreshToken || undefined,
          expiresAt: connection.tokenExpiresAt || undefined,
          platformAccountId: connection.platformAccountId,
          pageId: connection.pageId || undefined,
        }
      );

      // Update post as published
      await prisma.contentPost.update({
        where: { id: post.id },
        data: {
          status: "published",
          publishedAt: new Date(),
          platformPostId: result.platformPostId,
          platformUrl: result.platformUrl,
        },
      });

      // Increment campaign counter if linked
      if (post.campaignId) {
        await prisma.contentCampaign.update({
          where: { id: post.campaignId },
          data: { postsPublished: { increment: 1 } },
        });
      }

      published++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown publish error";
      await prisma.contentPost.update({
        where: { id: post.id },
        data: {
          status: "failed",
          errorMessage: errorMsg.slice(0, 500),
          retryCount: { increment: 1 },
        },
      });
      failed++;
      console.error(`[content-publish] Failed post ${post.id}:`, errorMsg);
    }
  }

  return { processed: duePosts.length, published, failed, skipped };
}

// ── Token Refresh ───────────────────────────────────────────

export interface TokenRefreshResult {
  checked: number;
  refreshed: number;
  failed: number;
}

/**
 * Refresh tokens expiring within 12 hours.
 * Called by /api/cron/token-refresh every 6 hours.
 */
export async function refreshExpiringTokens(): Promise<TokenRefreshResult> {
  const twelveHoursFromNow = new Date(Date.now() + 12 * 60 * 60 * 1000);
  let refreshed = 0;
  let refreshFailed = 0;

  const expiring = await prisma.platformConnection.findMany({
    where: {
      status: "active",
      refreshToken: { not: null },
      tokenExpiresAt: { lte: twelveHoursFromNow },
    },
  });

  for (const conn of expiring) {
    if (!conn.refreshToken) continue;

    try {
      const adapter = getAdapter(conn.platform as PlatformType);
      if (!adapter) continue;

      const newTokens = await adapter.refreshToken(conn.refreshToken);

      await prisma.platformConnection.update({
        where: { id: conn.id },
        data: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken || conn.refreshToken,
          tokenExpiresAt: newTokens.expiresAt,
          status: "active",
          lastError: null,
        },
      });

      refreshed++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Token refresh failed";
      await prisma.platformConnection.update({
        where: { id: conn.id },
        data: {
          status: "expired",
          lastError: errorMsg.slice(0, 500),
        },
      });
      refreshFailed++;
      console.error(`[token-refresh] Failed for ${conn.platform}/${conn.id}:`, errorMsg);
    }
  }

  return { checked: expiring.length, refreshed, failed: refreshFailed };
}
