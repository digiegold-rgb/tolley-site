import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  classifyRequest,
  plexFromSettings,
  progressPercent,
  requestQuality,
  toPipelineItem,
  volumesFromArr,
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

describe("requestQuality — this site uses profileId 5 for 4K, not is4k", () => {
  it("treats profileId 5 as 4K even when is4k is false", () => {
    assert.equal(requestQuality({ profileId: 5, is4k: false }), "4k");
  });
  it("treats Overseerr is4k as 4K", () => {
    assert.equal(requestQuality({ profileId: 4, is4k: true }), "4k");
  });
  it("defaults HD-1080p profile 4 to hd", () => {
    assert.equal(requestQuality({ profileId: 4, is4k: false }), "hd");
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
  it("DECLINED and deleted media are failed / aired-out", () => {
    assert.equal(classifyRequest(req({ status: 3 })), "failed");
    assert.equal(classifyRequest(req({ status: 2, media: { status: 6 } })), "failed");
  });
  it("processing or queued items are downloading", () => {
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
  it("keeps 4K vs HD on the item", () => {
    const item = toPipelineItem(req({ profileId: 5, media: { tmdbId: 42, status: 4, title: "Dune" } }));
    assert.equal(item.quality, "4k");
    assert.equal(item.title, "Dune");
    assert.equal(item.bucket, "downloading");
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

describe("storage + plex mapping never leaks arr keys", () => {
  it("maps Radarr/Sonarr volumes from settings GET", () => {
    const vols = volumesFromArr("radarr", [
      { name: "Radarr", activeDirectory: "/movies", activeProfileName: "HD-1080p", is4k: false, apiKey: "SECRET" },
    ]);
    assert.equal(vols.length, 1);
    assert.equal(vols[0].path, "/movies");
    assert.equal(JSON.stringify(vols).includes("SECRET"), false);
  });
  it("Plex is connected when machineId is present", () => {
    assert.deepEqual(plexFromSettings({ name: "Tolley", machineId: "abc" }), {
      connected: true,
      name: "Tolley",
    });
    assert.deepEqual(plexFromSettings({}), { connected: false, name: null });
  });
});

describe("acquire + DVR paths stay untouched", () => {
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
});
