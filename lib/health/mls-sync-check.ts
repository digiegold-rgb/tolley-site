/**
 * lib/health/mls-sync-check.ts
 *
 * MLS sync staleness check. The research worker on the DGX keeps Listing rows
 * fresh via Listing.lastSynced; if the newest lastSynced is older than 24h
 * (or the table is empty) the whole motivated-seller pipeline is running on
 * dead data. Alerts Telegram, deduped to one ping per 12h via the DB-backed
 * rate limiter.
 */

import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { notifyTelegram } from "@/lib/budget/notify";

const STALE_MS = 24 * 60 * 60 * 1000; // 24h
const DEDUPE_KEY = "health:mls-stale";
const DEDUPE_WINDOW_SECONDS = 43200; // 12h

export interface MlsSyncStatus {
  ok: boolean;
  newestSync: string | null; // ISO, null when Listing table is empty
}

export async function checkMlsSync(): Promise<MlsSyncStatus> {
  const newest = await prisma.listing.findFirst({
    orderBy: { lastSynced: "desc" },
    select: { lastSynced: true },
  });

  const newestSync = newest?.lastSynced ?? null;
  const ok =
    newestSync != null && Date.now() - newestSync.getTime() < STALE_MS;

  if (!ok) {
    const rl = await consumeRateLimit(DEDUPE_KEY, 1, DEDUPE_WINDOW_SECONDS);
    if (rl.allowed) {
      const when = newestSync
        ? newestSync.toISOString()
        : "never (Listing table empty)";
      const res = await notifyTelegram(
        `⚠️ MLS sync STALE — newest listing synced ${when}. Check xvfb.service + research worker on DGX.`,
      );
      if (!res.ok) {
        console.error("[mls-sync-check] Telegram notify failed:", res.error);
      }
    }
  }

  return { ok, newestSync: newestSync ? newestSync.toISOString() : null };
}
