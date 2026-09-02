import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  RETRY_COOLDOWN_MS,
  STUCK_MS,
  classifyMotion,
  classifyRequest,
  formatQueueAge,
  formatRetriedAgo,
  overseerrRetryPath,
  progressPercent,
  requestQuality,
  runStuckRetries,
  shouldAutoRetry,
  stateEnteredAt,
  toPipelineItem,
  type RawRequest,
} from "./tv-analytics.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readApp(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function req(partial: RawRequest): RawRequest {
  return {
    id: 1,
    status: 2,
    type: "movie",
    is4k: false,
    profileId: 4,
    media: { tmdbId: 99, status: 3, downloadStatus: [] },
    ...partial,
    media: { tmdbId: 99, status: 3, downloadStatus: [], ...(partial.media || {}) },
  };
}

describe("requestQuality — profileId 5 vs 4; TV has no 4K path", () => {
  it("treats movie profileId 5 as 4K", () => {
    assert.equal(requestQuality({ type: "movie", profileId: 5, is4k: false }), "4k");
  });
  it("treats movie profileId 4 as HD", () => {
    assert.equal(requestQuality({ type: "movie", profileId: 4, is4k: false }), "hd");
  });
  it("never badges TV as 4K", () => {
    assert.equal(requestQuality({ type: "tv", profileId: 5, is4k: true }), "hd");
  });
});

describe("progressPercent", () => {
  it("returns null when the queue is empty", () => {
    assert.equal(progressPercent([]), null);
    assert.equal(progressPercent(undefined), null);
  });
  it("computes percent from size / sizeLeft", () => {
    assert.equal(progressPercent([{ size: 1000, sizeLeft: 250 }]), 75);
  });
  it("sums multiple Sonarr episodes", () => {
    assert.equal(
      progressPercent([
        { size: 100, sizeLeft: 50 },
        { size: 100, sizeLeft: 0 },
      ]),
      75,
    );
  });
});

describe("classifyRequest", () => {
  it("FAILED requests need a retry", () => {
    assert.equal(classifyRequest(req({ status: 4 })), "needs_retry");
  });
  it("DECLINED and deleted media are failed", () => {
    assert.equal(classifyRequest(req({ status: 3 })), "failed");
    assert.equal(classifyRequest(req({ status: 2, media: { status: 6 } })), "failed");
  });
  it("processing (import pending / blocked) is downloading", () => {
    assert.equal(classifyRequest(req({ status: 2, media: { status: 3 } })), "downloading");
    assert.equal(
      classifyRequest(
        req({
          status: 2,
          media: { status: 2, downloadStatus: [{ size: 10, sizeLeft: 4, status: "downloading" }] },
        }),
      ),
      "downloading",
    );
  });
  it("approved with no queue is waiting", () => {
    assert.equal(classifyRequest(req({ status: 2, media: { status: 2, downloadStatus: [] } })), "waiting");
  });
  it("available on Plex", () => {
    assert.equal(classifyRequest(req({ status: 2, media: { status: 5 } })), "available");
  });
});

describe("toPipelineItem", () => {
  it("keeps 4K vs HD and externalServiceId", () => {
    const item = toPipelineItem(
      req({ profileId: 5, media: { tmdbId: 42, status: 3, title: "Dune", externalServiceId: 11 } }),
    );
    assert.equal(item.quality, "4k");
    assert.equal(item.title, "Dune");
    assert.equal(item.bucket, "downloading");
    assert.equal(item.externalServiceId, 11);
    assert.match(item.downloadLabel || "", /processing/);
  });
  it("uses a title hint from the movie/tv GET", () => {
    const item = toPipelineItem(req({ media: { tmdbId: 7, status: 4 } }), {
      title: "Andor",
      year: "2022",
      posterPath: "/x.jpg",
    });
    assert.equal(item.title, "Andor");
    assert.equal(item.year, "2022");
    assert.equal(item.poster, "https://image.tmdb.org/t/p/w185/x.jpg");
  });
});

describe("queue age uses updatedAt (time in this state), not createdAt", () => {
  const now = Date.parse("2026-09-02T12:00:00.000Z");

  it("stateEnteredAt prefers updatedAt so pending→processing does not look 2 days old", () => {
    // createdAt is the original request. updatedAt is when Overseerr last
    // changed this row (approve / media.status). Using createdAt here would
    // report 36h in-queue and flip a just-started grab to stuck.
    const createdAt = "2026-09-01T00:00:00.000Z";
    const updatedAt = "2026-09-02T11:30:00.000Z";
    assert.equal(stateEnteredAt({ createdAt, updatedAt }), updatedAt);
    assert.equal(stateEnteredAt({ createdAt }), createdAt);

    const item = toPipelineItem(
      req({
        createdAt,
        updatedAt,
        media: { status: 2, downloadStatus: [] },
      }),
      undefined,
      { now },
    );
    assert.equal(item.bucket, "waiting");
    assert.equal(item.ageLabel, "in queue 30m");
    assert.equal(item.motion, "moving");
    assert.equal(item.ageMs, 30 * 60 * 1000);

    const ifCreatedAt = toPipelineItem(
      req({
        createdAt,
        // no updatedAt — fallback, documented here
        media: { status: 2, downloadStatus: [] },
      }),
      undefined,
      { now },
    );
    assert.equal(ifCreatedAt.ageLabel, "in queue 36h");
    assert.equal(ifCreatedAt.motion, "stuck");
  });

  it("formatQueueAge is 'in queue 3h 12m'", () => {
    assert.equal(formatQueueAge(3 * 3600_000 + 12 * 60_000), "in queue 3h 12m");
    assert.equal(formatQueueAge(45 * 60_000), "in queue 45m");
    assert.equal(formatQueueAge(2 * 3600_000), "in queue 2h");
  });
});

describe("classifyMotion — moving vs stuck", () => {
  const now = Date.parse("2026-09-02T12:00:00.000Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("moving: progress>0 or timeLeft, age under STUCK_MS", () => {
    const item = toPipelineItem(
      req({
        updatedAt: ago(20 * 60_000),
        media: {
          status: 3,
          downloadStatus: [{ size: 1000, sizeLeft: 400, timeLeft: "40m", status: "downloading" }],
        },
      }),
      undefined,
      { now },
    );
    assert.equal(item.progress, 60);
    assert.equal(item.timeLeft, "40m");
    assert.equal(item.motion, "moving");
    assert.equal(item.ageLabel, "in queue 20m");
  });

  it("a healthy transfer stays moving after STUCK_MS — the clock is for idle rows", () => {
    const item = toPipelineItem(
      req({
        updatedAt: ago(STUCK_MS + 60_000),
        media: {
          status: 3,
          downloadStatus: [{ size: 1000, sizeLeft: 200, timeLeft: "3h", status: "downloading" }],
        },
      }),
      undefined,
      { now },
    );
    assert.equal(item.progress, 80);
    assert.equal(item.timeLeft, "3h");
    assert.equal(item.motion, "moving");
  });

  it("stuck: processing/waiting with no progress and no timeLeft for >= 2h", () => {
    const item = toPipelineItem(
      req({
        updatedAt: ago(STUCK_MS),
        media: { status: 2, downloadStatus: [] },
      }),
      undefined,
      { now },
    );
    assert.equal(item.bucket, "waiting");
    assert.equal(item.progress, null);
    assert.equal(item.timeLeft, null);
    assert.equal(item.motion, "stuck");
    assert.equal(item.ageLabel, "in queue 2h");
  });

  it("waiting under 2h with no signal is still moving (grace)", () => {
    const item = toPipelineItem(
      req({
        updatedAt: ago(30 * 60_000),
        media: { status: 2, downloadStatus: [] },
      }),
      undefined,
      { now },
    );
    assert.equal(item.bucket, "waiting");
    assert.equal(item.motion, "moving");
  });

  it("stuck: downloadLabel mentions import pending/blocked", () => {
    const item = toPipelineItem(
      req({
        updatedAt: ago(5 * 60_000),
        media: { status: 3, downloadStatus: [] },
      }),
      undefined,
      { now },
    );
    assert.match(item.downloadLabel || "", /import pending|blocked/i);
    assert.equal(item.motion, "stuck");
    assert.equal(item.ageLabel, "in queue 5m");
  });

  it("stuck: mediaStatus PROCESSING with 0 progress for >= 2h", () => {
    const item = toPipelineItem(
      req({
        updatedAt: ago(STUCK_MS),
        media: {
          status: 3,
          downloadStatus: [{ size: 1000, sizeLeft: 1000, status: "queued" }],
        },
      }),
      undefined,
      { now },
    );
    assert.equal(item.mediaStatus, 3);
    assert.equal(item.progress, 0);
    assert.equal(item.downloadLabel, "queued");
    assert.equal(item.motion, "stuck");
  });

  it("PROCESSING with 0 progress under 2h is moving when the label is not import-blocked", () => {
    const item = toPipelineItem(
      req({
        updatedAt: ago(30 * 60_000),
        media: {
          status: 3,
          downloadStatus: [{ size: 1000, sizeLeft: 1000, status: "queued" }],
        },
      }),
      undefined,
      { now },
    );
    assert.equal(item.progress, 0);
    assert.equal(item.motion, "moving");
  });

  it("available / failed rows have no motion", () => {
    assert.equal(
      classifyMotion({
        bucket: "available",
        progress: null,
        timeLeft: null,
        downloadLabel: "on Plex",
        mediaStatus: 5,
        ageMs: STUCK_MS,
      }),
      null,
    );
    assert.equal(
      toPipelineItem(req({ status: 3, media: { status: 6 } }), undefined, { now }).motion,
      null,
    );
  });
});

describe("acquire + DVR paths stay untouched; analytics stays on Overseerr", () => {
  it("POST /api/tv/request still sends seasons=all and profileId 5 for 4K movies", () => {
    const src = readApp("app/api/tv/request/route.ts");
    assert.match(src, /payload\.seasons = "all"/);
    assert.match(src, /body\.quality === "4k"\) payload\.profileId = 5/);
    assert.match(src, /method: "POST"/);
    assert.equal(/export async function GET/.test(src), false);
  });
  it("search, discover, and DVR proxy files are unchanged by this feature", () => {
    const search = readApp("app/api/tv/search/route.ts");
    const discover = readApp("app/api/tv/discover/route.ts");
    const dvr = readApp("app/api/tv/[...path]/route.ts");
    assert.match(search, /\/api\/v1\/search\?query=/);
    assert.match(discover, /\/api\/v1\/discover\//);
    assert.match(dvr, /TV_API_URL \|\| "https:\/\/tv-dvr\.tolley\.io"/);
  });
  it("analytics GETs NAS Overseerr only — no DVR host, no Arr/Plex settings", () => {
    const src = readApp("app/api/tv/analytics/route.ts");
    assert.match(src, /OVERSEERR_URL \|\| "https:\/\/tv-api\.tolley\.io"/);
    assert.match(src, /\/api\/v1\/request\/count/);
    assert.match(src, /filter=processing/);
    assert.match(src, /filter=failed/);
    assert.match(src, /filter=available/);
    assert.match(src, /\/api\/v1\/request\/\$\{/);
    assert.equal(src.includes("tv-dvr.tolley.io"), false);
    assert.equal(src.includes("TV_API"), false);
    assert.equal(src.includes("settings/radarr"), false);
    assert.equal(src.includes("settings/sonarr"), false);
    assert.equal(src.includes("settings/plex"), false);
    assert.equal(src.includes("RADARR"), false);
    assert.equal(src.includes("SONARR"), false);
    assert.equal(src.includes("TRANSMISSION"), false);
  });
  it("Analytics is the last tab pill; MediaCard and request() stay in tv-client", () => {
    const src = readApp("app/tv/tv-client.tsx");
    const analyticsAt = src.indexOf("📊 Analytics");
    const dvrAt = src.indexOf("Live &amp; DVR");
    assert.ok(dvrAt > 0 && analyticsAt > dvrAt, "Analytics tab must come after Live & DVR");
    assert.match(src, /function MediaCard\(/);
    assert.match(src, /async function request\(m: Result, quality\?: "4k"\)/);
    assert.match(src, /body: JSON\.stringify\(\{ mediaType: m\.mediaType, mediaId: m\.id, quality \}\)/);
  });
  it("does not add a vercel.json functions key for the analytics route", () => {
    const vercel = JSON.parse(readApp("vercel.json")) as { functions: Record<string, unknown> };
    assert.equal(vercel.functions["app/api/tv/analytics/route.ts"], undefined);
  });
  it("analytics splits processingMoving / processingStuck from motion; nas stays unwired", () => {
    const src = readApp("app/api/tv/analytics/route.ts");
    assert.match(src, /processingMoving/);
    assert.match(src, /processingStuck/);
    assert.match(src, /i\.motion === "stuck"/);
    assert.match(src, /i\.motion === "moving"/);
    assert.match(src, /wired:\s*false/);
    assert.equal(src.includes("peer"), false);
    assert.equal(src.includes("seeders"), false);
  });
  it("Analytics UI shows STUCK / MOVING badges, queue age, and both counts", () => {
    const src = readApp("app/tv/tv-analytics.tsx");
    assert.match(src, /STUCK/);
    assert.match(src, /MOVING/);
    assert.match(src, /m\.ageLabel/);
    assert.match(src, /m\.retriedLabel/);
    assert.match(src, /processingMoving/);
    assert.match(src, /processingStuck/);
    assert.match(src, /m\.timeLeft/);
    assert.match(src, /m\.progress/);
  });
  it("does not add a vercel.json functions key for the stuck-retry cron", () => {
    const vercel = JSON.parse(readApp("vercel.json")) as {
      functions: Record<string, unknown>;
      crons: Array<{ path: string }>;
    };
    assert.equal(vercel.functions["app/api/cron/tv-stuck-retry/route.ts"], undefined);
    assert.ok(vercel.crons.some((c) => c.path === "/api/cron/tv-stuck-retry"));
  });
  it("stuck-retry cron hits Overseerr retry only — CRON_SECRET, no delete, no profile change", () => {
    const src = readApp("app/api/cron/tv-stuck-retry/route.ts");
    assert.match(src, /CRON_SECRET/);
    assert.match(src, /overseerrRetryPath/);
    assert.match(src, /overseerr\("POST", overseerrRetryPath/);
    assert.equal(src.includes("DELETE"), false);
    assert.equal(/profileId\s*=/.test(src), false);
    assert.equal(src.includes("tv-dvr.tolley.io"), false);
    assert.equal(src.includes("RADARR"), false);
    assert.equal(src.includes("TRANSMISSION"), false);
    assert.match(src, /wired:\s*false/);
  });
});

describe("built-in watcher retries stuck rows once", () => {
  const now = Date.parse("2026-09-02T12:00:00.000Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("stuck+2h → retry called (Overseerr /request/{id}/retry, same profile)", async () => {
    const item = toPipelineItem(
      req({
        id: 42,
        profileId: 5,
        updatedAt: ago(STUCK_MS),
        media: { status: 2, downloadStatus: [] },
      }),
      undefined,
      { now },
    );
    assert.equal(item.bucket, "waiting");
    assert.equal(item.motion, "stuck");
    assert.equal(item.importBlocked, false);
    assert.equal(shouldAutoRetry(item, { now }).retry, true);
    assert.equal(overseerrRetryPath(42), "/api/v1/request/42/retry");

    const called: number[] = [];
    const result = await runStuckRetries([item], {
      now,
      retry: async (id) => {
        called.push(id);
        return { ok: true, status: 200 };
      },
    });
    assert.deepEqual(called, [42]);
    assert.equal(result.retried[0]?.id, 42);
    assert.equal(item.profileId, 5);
  });

  it("importBlocked → not retried (NAS remount, not another grab)", async () => {
    const item = toPipelineItem(
      req({
        id: 7,
        updatedAt: ago(STUCK_MS * 2),
        media: { status: 3, downloadStatus: [{ status: "importBlocked" }] },
      }),
      undefined,
      { now },
    );
    assert.equal(item.importBlocked, true);
    assert.equal(shouldAutoRetry(item, { now }).reason, "import_blocked");

    const fallback = toPipelineItem(
      req({
        id: 8,
        updatedAt: ago(STUCK_MS * 2),
        media: { status: 3, downloadStatus: [] },
      }),
      undefined,
      { now },
    );
    assert.match(fallback.downloadLabel || "", /import pending|blocked/i);
    assert.equal(shouldAutoRetry(fallback, { now }).retry, false);

    const called: number[] = [];
    await runStuckRetries([item, fallback], {
      now,
      retry: async (id) => {
        called.push(id);
        return { ok: true };
      },
    });
    assert.deepEqual(called, []);
  });

  it("second hit inside 24h → not retried", async () => {
    const item = toPipelineItem(
      req({
        id: 99,
        updatedAt: ago(STUCK_MS),
        media: { status: 2, downloadStatus: [] },
      }),
      undefined,
      { now, lastRetryAt: ago(60 * 60_000) },
    );
    assert.equal(item.motion, "stuck");
    assert.equal(item.retriedLabel, "retried 1h ago");
    assert.ok((item.lastRetryAt && Date.parse(item.lastRetryAt) > now - RETRY_COOLDOWN_MS) ?? false);
    assert.equal(shouldAutoRetry(item, { now }).reason, "cooldown");

    const called: number[] = [];
    const result = await runStuckRetries([item], {
      now,
      lastRetryAtById: new Map([[99, ago(60 * 60_000)]]),
      retry: async (id) => {
        called.push(id);
        return { ok: true };
      },
    });
    assert.deepEqual(called, []);
    assert.equal(result.skipped[0]?.reason, "cooldown");
  });

  it("formatRetriedAgo is 'retried 18m ago'", () => {
    assert.equal(formatRetriedAgo(18 * 60_000), "retried 18m ago");
  });
});
