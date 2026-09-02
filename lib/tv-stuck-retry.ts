/**
 * Prisma helpers for the stuck-retry watcher. Decision + runner live in
 * tv-analytics.ts so unit tests do not load the database client.
 *
 * SyncLog.source = "tv-retry-{id}" — existing table, no TV-request migration.
 * If the write fails, cooldown is best-effort on the next invoke.
 */

import { prisma } from "@/lib/prisma";
import {
  RETRY_COOLDOWN_MS,
  TV_RETRY_LOG_PREFIX,
  parseTvRetryLogSource,
  tvRetryLogSource,
} from "@/lib/tv-analytics";

export { runStuckRetries, overseerrRetryPath, shouldAutoRetry } from "@/lib/tv-analytics";

export async function loadRecentTvRetries(
  sinceMs = RETRY_COOLDOWN_MS,
  now = Date.now(),
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  try {
    const rows = await prisma.syncLog.findMany({
      where: {
        source: { startsWith: TV_RETRY_LOG_PREFIX },
        createdAt: { gte: new Date(now - Math.max(sinceMs, RETRY_COOLDOWN_MS)) },
      },
      orderBy: { createdAt: "desc" },
      select: { source: true, createdAt: true },
      take: 80,
    });
    for (const row of rows) {
      const id = parseTvRetryLogSource(row.source);
      if (!id || out.has(id)) continue;
      out.set(id, row.createdAt.toISOString());
    }
  } catch {
    // Missing DB does not touch Overseerr / TV requests.
  }
  return out;
}

export async function recordTvRetry(requestId: number, at: string): Promise<void> {
  await prisma.syncLog.create({
    data: {
      source: tvRetryLogSource(requestId),
      recordsTotal: 1,
      recordsUpdated: 1,
      createdAt: new Date(at),
    },
  });
}
