import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  dripStageOf,
  matchHouseVideo,
  normalizeTitle,
  projectTitle,
  shapeStudioVideo,
  studioEncouragement,
  studioHighlight,
  youtubeIdFromUrl,
} from "./studio-library.ts";

const house = [
  {
    videoId: "abc123",
    title: "Ruthann walks the farm",
    views: 4400,
    url: "https://www.youtube.com/watch?v=abc123",
    channelLabel: "Ruthann",
    platform: "youtube",
  },
];

describe("studio library helpers", () => {
  it("matches HQ videos by youtube id, then by normalized title", () => {
    assert.equal(
      matchHouseVideo({ id: "p1", youtubeVideoId: "abc123" }, house)?.views,
      4400,
    );
    assert.equal(
      matchHouseVideo(
        { id: "p2", sourceUrl: "https://youtu.be/abc123" },
        house,
      )?.videoId,
      "abc123",
    );
    assert.equal(
      matchHouseVideo(
        { id: "p3", publishTitle: "Ruthann walks the farm" },
        house,
      )?.views,
      4400,
    );
    assert.equal(
      matchHouseVideo({ id: "p4", publishTitle: "Unrelated clip" }, house),
      null,
    );
    assert.equal(matchHouseVideo({ id: "p5", publishTitle: "Hi" }, house), null);
  });

  it("parses youtube ids from watch / shorts / youtu.be urls", () => {
    assert.equal(youtubeIdFromUrl("https://www.youtube.com/watch?v=xyz"), "xyz");
    assert.equal(youtubeIdFromUrl("https://youtu.be/xyz?t=12"), "xyz");
    assert.equal(youtubeIdFromUrl("https://www.youtube.com/shorts/xyz"), "xyz");
    assert.equal(youtubeIdFromUrl("https://example.com/nope"), null);
  });

  it("encourages an empty studio to make a video", () => {
    assert.match(studioEncouragement("Ruthann", []), /Ruthann is waiting/);
    assert.match(studioEncouragement("Estate", []), /make a video/);
  });

  it("celebrates views and posted clips", () => {
    const video = shapeStudioVideo(
      {
        id: "p1",
        publishTitle: "Farm morning",
        status: "ready",
        finalVideoUrl: "https://x.blob.vercel-storage.com/a.mp4",
        youtubeVideoId: "abc123",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
      { views: 4400, house: house[0] },
    );
    assert.equal(video.posted, true);
    assert.equal(video.views, 4400);
    assert.equal(video.houseMatch?.channelLabel, "Ruthann");
    assert.match(studioEncouragement("Ruthann", [video]), /cooking/);
    assert.equal(studioHighlight([video])?.kind, "views");
    assert.equal(studioHighlight([video])?.value, 4400);
  });

  it("uses library-local stats when there is no HQ match", () => {
    const video = shapeStudioVideo(
      {
        id: "p9",
        publishTitle: "Draft cut",
        status: "ready",
        finalVideoUrl: "https://x.blob.vercel-storage.com/b.mp4",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
      { dripStage: "scheduled" },
    );
    assert.equal(video.houseMatch, null);
    assert.equal(video.views, null);
    assert.equal(video.dripStage, "scheduled");
    assert.equal(video.previewKind, "final-video");
    assert.match(studioEncouragement("Estate", [video]), /ready to post/);
  });

  it("maps drip statuses and titles", () => {
    assert.equal(dripStageOf("scheduled"), "scheduled");
    assert.equal(dripStageOf("published"), "published");
    assert.equal(dripStageOf("failed"), null);
    assert.equal(projectTitle({ id: "x", publishTitle: " Hello " }), "Hello");
    assert.equal(normalizeTitle("12 — Farm, morning!"), "farm morning");
  });
});

describe("Socials is per-studio; house dump lives on the dashboard", () => {
  it("SocialsScreen does not mount HousePostsDashboard", async () => {
    const screen = await readFile(
      "components/animate/screens/socials/SocialsScreen.tsx",
      "utf8",
    );
    assert.equal(screen.includes("HousePostsDashboard"), false);
    assert.match(screen, /\/api\/vater\/socials\/studio/);
    assert.match(screen, /data-testid="studio-socials"/);
  });

  it("DashboardScreen mounts the house block for owners and the all-studio strip", async () => {
    const dash = await readFile(
      "components/animate/screens/DashboardScreen.tsx",
      "utf8",
    );
    assert.match(dash, /HousePostsDashboard/);
    assert.match(dash, /ActiveVideosStrip/);
    assert.equal(/fetch\(['"`]\/api\/hq\//.test(dash), false);
  });

  it("studio + overview routes stay off vercel.json functions", async () => {
    const studio = await readFile("app/api/vater/socials/studio/route.ts", "utf8");
    const overview = await readFile(
      "app/api/vater/socials/overview/route.ts",
      "utf8",
    );
    const vercel = await readFile("vercel.json", "utf8");
    assert.match(studio, /loadStudioPayload/);
    assert.match(studio, /lite/);
    assert.match(overview, /loadOverviewPayload/);
    assert.equal(studio.includes("collectAdsSnapshot"), false);
    assert.equal(overview.includes("loadHousePosts"), false);
    assert.equal(vercel.includes("app/api/vater/socials/studio"), false);
    assert.equal(vercel.includes("app/api/vater/socials/overview"), false);
  });
});
