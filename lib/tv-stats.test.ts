import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  formatBytes,
  isImportBlockedCandidate,
  matchLiveRow,
  normalizeTitle,
  parseRetryCandidates,
  parseTvStats,
  planTvStatsRetry,
  runTvStatsRetries,
  summarizeStorage,
  titlesMatch,
} from "./tv-stats.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readApp(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const sample = parseTvStats({
  ok: true,
  ts: "2026-09-02T02:00:00.000Z",
  transmission: [
    {
      id: 11,
      downloadId: "abc123",
      name: "Dune.2021.2160p.WEB-DL.x265",
      percentDone: 0.42,
      eta: 5400,
      peersConnected: 18,
      errorString: "",
      status: 4,
      downloadDir: "/downloads/complete",
    },
    {
      name: "The.Bear.S03E02.1080p.WEBRip",
      percentDone: 0.9,
      eta: 120,
      peersConnected: 6,
      status: 4,
      downloadDir: "/downloads/complete",
    },
  ],
  radarrQueue: [
    {
      id: 101,
      downloadId: "abc123",
      title: "Dune (2021)",
      trackedDownloadState: "downloading",
      sizeleft: 4_000_000_000,
      timeleft: "1h 30m",
      protocol: "torrent",
      status: "downloading",
    },
  ],
  sonarrQueue: Array.from({ length: 2 }, (_, i) => ({
    title: i === 0 ? "The Bear - S03E02" : "Andor - S01E01",
    trackedDownloadState: i === 0 ? "downloading" : "importPending",
    sizeleft: 100,
    timeleft: "00:02:00",
    protocol: "torrent",
    status: "downloading",
  })),
  diskspace: [
    { source: "transmission", path: "/downloads", label: "Transmission download dir", free: 1.03 * 1024 ** 4, total: 4 * 1024 ** 4 },
    { source: "plex", path: "/mnt/plex-movies", label: "plex-movies", free: 200 * 1024 ** 2, total: 8 * 1024 ** 4 },
    { source: "plex", path: "/mnt/plex-tv", label: "plex-tv", free: 198 * 1024 ** 2, total: 12 * 1024 ** 4 },
  ],
  rootfolders: [
    { source: "radarr", path: "/movies", label: "plex-movies", free: 200 * 1024 ** 2, accessible: true },
    { source: "sonarr", path: "/tv", label: "plex-tv", free: 198 * 1024 ** 2, accessible: true },
  ],
  errors: [],
});

describe("normalizeTitle + titlesMatch", () => {
  it("strips year / quality so Overseerr titles match torrent names", () => {
    assert.equal(normalizeTitle("Dune.2021.2160p.WEB-DL.x265"), "dune");
    assert.ok(titlesMatch("Dune", "Dune.2021.2160p.WEB-DL.x265"));
    assert.ok(titlesMatch("The Bear", "The.Bear.S03E02.1080p.WEBRip"));
    assert.equal(titlesMatch("Andor", "Dune.2021.2160p"), false);
  });
});

describe("matchLiveRow — snapshot fields on a processing row", () => {
  it("attaches peersConnected, percentDone, eta, trackedDownloadState", () => {
    const hit = matchLiveRow("Dune", sample);
    assert.ok(hit);
    assert.equal(hit.source, "transmission");
    assert.equal(hit.peersConnected, 18);
    assert.equal(hit.percentDone, 42);
    assert.equal(hit.eta, "1h 30m");
    assert.equal(hit.trackedDownloadState, "downloading");
    assert.equal(sample.transmission[0]?.id, 11);
    assert.equal(sample.transmission[0]?.downloadId, "abc123");
    assert.equal(sample.radarrQueue[0]?.id, 101);
    assert.equal(sample.radarrQueue[0]?.downloadId, "abc123");
  });
  it("does not invent peers when only Arr queue matches", () => {
    const hit = matchLiveRow("Andor", sample);
    assert.ok(hit);
    assert.equal(hit.source, "sonarr");
    assert.equal(hit.peersConnected, null);
    assert.equal(hit.trackedDownloadState, "importPending");
  });
});

describe("summarizeStorage — stale NFS bind", () => {
  it("flags tiny plex-movies/tv free vs Transmission download-dir TB", () => {
    const sum = summarizeStorage(sample);
    assert.equal(sum.staleNfs, true);
    assert.match(sum.staleNote || "", /stale NFS bind/);
    assert.equal(sum.torrentCount, 2);
    assert.equal(sum.radarrCount, 1);
    assert.ok(sum.volumes.some((v) => v.kind === "plex-movies"));
    assert.ok(sum.volumes.some((v) => v.kind === "plex-tv"));
    assert.match(formatBytes(200 * 1024 ** 2), /MB/);
    assert.match(formatBytes(1.03 * 1024 ** 4), /TB/);
  });
  it("does not flag when plex free is also large", () => {
    const fat = parseTvStats({
      ok: true,
      transmission: [{ name: "x", downloadDir: "/downloads/complete" }],
      diskspace: [
        { path: "/downloads", label: "Transmission download dir", free: 1.03 * 1024 ** 4, total: 4 * 1024 ** 4 },
        { path: "/mnt/plex-movies", label: "plex-movies", free: 2 * 1024 ** 4, total: 8 * 1024 ** 4 },
      ],
      rootfolders: [{ source: "radarr", path: "/movies", label: "plex-movies", free: 2 * 1024 ** 4 }],
    });
    assert.equal(summarizeStorage(fat).staleNfs, false);
  });
});

describe("tv-stats proxy stays on its own host", () => {
  it("GET /api/tv/stats uses TV_STATS_URL + TV_API_KEY — not Overseerr, not DVR", () => {
    const src = readApp("app/api/tv/stats/route.ts");
    assert.match(src, /TV_STATS_URL \|\| DEFAULT_TV_STATS_URL/);
    assert.match(src, /tv-stats\.tolley\.io/);
    assert.match(src, /\/api\/status/);
    assert.match(src, /x-api-key/);
    assert.match(src, /TV_API_KEY/);
    assert.match(src, /validateShopAdmin/);
    assert.equal(src.includes("process.env.OVERSEERR"), false);
    assert.equal(src.includes("process.env.TV_API_URL"), false);
    assert.equal(src.includes("tv-dvr.tolley.io"), false);
    assert.equal(src.includes("tv-api.tolley.io"), false);
    assert.equal(src.includes("RADARR_"), false);
    assert.equal(src.includes("SONARR_"), false);
    assert.equal(src.includes("TRANSMISSION_"), false);
    assert.match(src, /wired:\s*false/);
  });
  it("does not add a vercel.json functions key for the stats route", () => {
    const vercel = JSON.parse(readApp("vercel.json")) as { functions: Record<string, unknown> };
    assert.equal(vercel.functions["app/api/tv/stats/route.ts"], undefined);
    assert.equal(vercel.functions["app/api/tv/analytics/route.ts"], undefined);
  });
  it("search, discover, request, and DVR proxy files stay off this wire", () => {
    const request = readApp("app/api/tv/request/route.ts");
    const search = readApp("app/api/tv/search/route.ts");
    const discover = readApp("app/api/tv/discover/route.ts");
    const dvr = readApp("app/api/tv/[...path]/route.ts");
    assert.match(search, /\/api\/v1\/search\?query=/);
    assert.match(discover, /\/api\/v1\/discover\//);
    assert.match(dvr, /TV_API_URL \|\| "https:\/\/tv-dvr\.tolley\.io"/);
    assert.equal(request.includes("tv-stats"), false);
    assert.equal(search.includes("tv-stats"), false);
    assert.equal(dvr.includes("tv-stats"), false);
  });
  it("stuck-retry cron uses tv-stats stalled retry and still skips import blocked", () => {
    const src = readApp("app/api/cron/tv-stuck-retry/route.ts");
    assert.match(src, /TV_STATS_URL \|\| DEFAULT_TV_STATS_URL/);
    assert.match(src, /tvStatsRetryCandidatesPath/);
    assert.match(src, /tvStatsRetryPath/);
    assert.match(src, /filter=failed/);
    assert.equal(src.includes("process.env.TV_API_URL"), false);
    assert.equal(src.includes("tv-dvr.tolley.io"), false);
    assert.match(src, /overseerrRetryPath/);
    const lib = readApp("lib/tv-analytics.ts");
    assert.match(lib, /import_blocked/);
    assert.match(lib, /isImportBlockedForRetry/);
    assert.match(lib, /not_failed/);
    const statsLib = readApp("lib/tv-stats.ts");
    assert.match(statsLib, /isImportBlockedCandidate/);
  });
  it("shop-admin/cron retry proxy stays on tv-stats — no functions key, no DVR host", () => {
    const src = readApp("app/api/tv/stats/retry/route.ts");
    assert.match(src, /validateShopAdmin/);
    assert.match(src, /CRON_SECRET/);
    assert.match(src, /TV_STATS_URL \|\| DEFAULT_TV_STATS_URL/);
    assert.match(src, /tvStatsRetryCandidatesPath/);
    assert.match(src, /tvStatsRetryPath/);
    assert.match(src, /TV_API_KEY/);
    assert.equal(src.includes("process.env.OVERSEERR"), false);
    assert.equal(src.includes("process.env.TV_API_URL"), false);
    assert.equal(src.includes("tv-dvr.tolley.io"), false);
    assert.equal(src.includes("RADARR_"), false);
    assert.equal(src.includes("TRANSMISSION_"), false);
    assert.match(src, /wired:\s*false/);
    const vercel = JSON.parse(readApp("vercel.json")) as { functions: Record<string, unknown> };
    assert.equal(vercel.functions["app/api/tv/stats/retry/route.ts"], undefined);
    assert.equal(vercel.functions["app/api/cron/tv-stuck-retry/route.ts"], undefined);
  });
});

describe("tv-stats stalled retry — candidates, never importBlocked", () => {
  it("parses candidate ids and skips importPending/importBlocked/imported", () => {
    const rows = parseRetryCandidates({
      candidates: [
        { id: 7, name: "Dune", trackedDownloadState: "downloading" },
        { id: 8, name: "Andor", trackedDownloadState: "importBlocked" },
        { id: 9, name: "Bear", trackedDownloadState: "importPending" },
        { id: 10, name: "Done", status: "imported" },
        { transmissionId: 11, title: "Stalled", status: "stopped" },
      ],
    });
    assert.equal(rows.length, 5);
    assert.equal(isImportBlockedCandidate(rows[1]!), true);
    assert.equal(isImportBlockedCandidate(rows[2]!), true);
    assert.equal(isImportBlockedCandidate(rows[3]!), true);
    const plan = planTvStatsRetry(rows);
    assert.deepEqual(plan.ids, [7, 11]);
    assert.deepEqual(plan.body, { ids: [7, 11] });
    assert.ok(plan.skipped.some((s) => s.id === 8 && s.reason === "import_blocked"));
    assert.equal(planTvStatsRetry([]).body, null);
  });

  it("POST { ids } for stalled candidates; empty eligible does not POST", async () => {
    const posted: Array<{ ids: number[] }> = [];
    const stalled = await runTvStatsRetries({
      getCandidates: async () => ({
        candidates: [
          { id: 21, name: "Stalled", trackedDownloadState: "downloading" },
          { id: 22, name: "Blocked", trackedDownloadState: "importBlocked" },
        ],
      }),
      postRetry: async (body) => {
        posted.push(body);
        return { ok: true, status: 200 };
      },
    });
    assert.deepEqual(posted, [{ ids: [21] }]);
    assert.deepEqual(stalled.retried, [21]);
    assert.equal(stalled.skipped[0]?.reason, "import_blocked");

    const none = await runTvStatsRetries({
      getCandidates: async () => ({
        candidates: [{ id: 22, trackedDownloadState: "importBlocked" }],
      }),
      postRetry: async (body) => {
        posted.push(body);
        return { ok: true };
      },
    });
    assert.equal(none.posted, null);
    assert.deepEqual(posted, [{ ids: [21] }]);
  });
});
