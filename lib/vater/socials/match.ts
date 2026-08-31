/**
 * Pure collector helpers — kept out of collector.ts so unit tests do not
 * import Prisma / the Zernio client.
 */
import {
  mergeMetrics,
  parseMetrics,
  vendorPostIdOf,
  type SocialMetrics,
} from "./metrics";

export function flattenInsight(raw: unknown): SocialMetrics {
  if (!raw || typeof raw !== "object") return parseMetrics(raw);
  const rec = raw as Record<string, unknown>;
  return mergeMetrics(
    parseMetrics(raw),
    parseMetrics(rec.channel),
    parseMetrics(rec.daily),
    parseMetrics(rec.history),
    parseMetrics(rec.account),
    parseMetrics(rec.metrics),
  );
}

/** Pair vendor analytics rows to our VaterSocialPost ids by externalPostId. */
export function matchAnalyticsToPosts(
  rows: unknown[],
  posts: Array<{ id: string; externalPostId: string }>,
): Array<{ postId: string; raw: unknown }> {
  const byExt = new Map(posts.map((p) => [p.externalPostId, p.id]));
  const out: Array<{ postId: string; raw: unknown }> = [];
  for (const row of rows) {
    const ext = vendorPostIdOf(row);
    if (!ext) continue;
    const postId = byExt.get(ext);
    if (!postId) continue;
    out.push({ postId, raw: row });
  }
  return out;
}

/** Same batchId retry: any existing row means do not create more. */
export function batchAlreadyBooked(existingCount: number): boolean {
  return existingCount > 0;
}
