import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";

import { shapeStudioVideo } from "./studio-library.ts";
import {
  canOpenLibraryPlayer,
  mergeLibraryProjects,
  openStudioVideoInLibrary,
  peekLibraryJumpSeed,
  rememberLibraryJump,
  studioVideoToLibrarySeed,
} from "./studio-client-cache.ts";

const video = shapeStudioVideo({
  id: "clip-112",
  publishTitle: "Ruthann walks the farm",
  status: "ready",
  finalVideoUrl: "https://x.blob.vercel-storage.com/vater-finals/ruthann-112.mp4",
  thumbnailUrl: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  completedAt: "2026-09-01T00:00:00.000Z",
});

describe("Socials → Library jump does not wait on the full grid", () => {
  it("seeds a playable Library row from the clicked Socials tile", () => {
    const seed = studioVideoToLibrarySeed(video);
    assert.equal(seed.id, "clip-112");
    assert.equal(
      seed.finalVideoUrl,
      "https://x.blob.vercel-storage.com/vater-finals/ruthann-112.mp4",
    );
    assert.equal(seed.sourceTitle, "Ruthann walks the farm");
    const merged = mergeLibraryProjects([], [], seed);
    assert.equal(canOpenLibraryPlayer(merged, "clip-112"), true);
    assert.equal(merged[0]?.id, "clip-112");
  });

  it("keeps the seed in front while the rest of Library hydrates", () => {
    const seed = studioVideoToLibrarySeed(video);
    const incoming = [
      { id: "other", finalVideoUrl: "https://x.blob.vercel-storage.com/a.mp4" },
    ];
    const merged = mergeLibraryProjects([], incoming, seed);
    assert.equal(merged[0]?.id, "clip-112");
    assert.equal(merged[1]?.id, "other");
    assert.equal(canOpenLibraryPlayer(merged, "clip-112"), true);
  });

  it("openStudioVideoInLibrary syncs selected id + library route", () => {
    const calls: string[] = [];
    openStudioVideoInLibrary(video, {
      setSelectedProjectId: (id) => calls.push(`id:${id}`),
      setRoute: (route) => calls.push(`route:${route}`),
    });
    assert.deepEqual(calls, ["id:clip-112", "route:library"]);
    assert.equal(peekLibraryJumpSeed()?.id, "clip-112");
    rememberLibraryJump(video);
    assert.equal(peekLibraryJumpSeed()?.finalVideoUrl, video.finalVideoUrl);
  });

  it("SocialsScreen paints from cache/lite and jumps via the seed helper", async () => {
    const screen = await readFile(
      "components/animate/screens/socials/SocialsScreen.tsx",
      "utf8",
    );
    assert.match(screen, /lite=1/);
    assert.match(screen, /readStudioPayloadCache/);
    assert.match(screen, /studio-video-skeleton/);
    assert.match(screen, /openStudioVideoInLibrary/);
    assert.match(screen, /setSelectedProjectId/);
    assert.match(screen, /setRoute/);
  });

  it("Library opens the selected id from the jump seed without blocking on fetch", async () => {
    const lib = await readFile(
      "components/animate/screens/studio/Library.tsx",
      "utf8",
    );
    assert.match(lib, /peekLibraryJumpSeed/);
    assert.match(lib, /mergeLibraryProjects/);
    assert.match(lib, /initialActiveId=\{selectedProjectId\}/);
    assert.match(lib, /loading && gridProjects.length === 0/);
  });
});
