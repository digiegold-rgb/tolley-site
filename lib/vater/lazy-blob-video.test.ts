/**
 * Invite investigation (2026-09-01):
 * 1) Socials grid mounted <video preload=metadata> per DGX tile — CONFIRMED.
 *    Ruthann ~112 mp4s on blob.vercel-storage.com. Rest-state first-frame
 *    (#108) is correct for a visible Library card; Socials small thumbs
 *    must not eager-load every mp4.
 * 2) GET /api/vater/socials/studio was serial/heavy (Zernio + house match
 *    + full project rows) — CONFIRMED. Lite payload + SWR cache first.
 * 3) Socials → Library remounted the grid and waited on /api/vater/youtube
 *    — CONFIRMED. Click now seeds selectedProjectId so the player can open.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";

import {
  BlobVideoGate,
  MAX_CONCURRENT_BLOB_VIDEOS,
  mayMountThumbVideo,
  shouldMountThumbVideo,
} from "./lazy-blob-video.ts";

/** How many of `total` rest-state final-video tiles would mount a <video>. */
export function restStateVideoCount(total: number, visible: number): number {
  let n = 0;
  for (let i = 0; i < total; i++) {
    if (
      shouldMountThumbVideo({
        previewKind: "final-video",
        hasStill: false,
        inView: i < visible,
      })
    ) {
      n += 1;
    }
  }
  return n;
}

describe("shouldMountThumbVideo — Socials / Library rest-state", () => {
  it("does not mount a video for offscreen final-video tiles", () => {
    assert.equal(
      shouldMountThumbVideo({
        previewKind: "final-video",
        hasStill: false,
        inView: false,
      }),
      false,
    );
  });

  it("may mount a visible final-video tile with no still", () => {
    assert.equal(
      shouldMountThumbVideo({
        previewKind: "final-video",
        hasStill: false,
        inView: true,
      }),
      true,
    );
    assert.equal(
      mayMountThumbVideo({ previewKind: "final-video", hasStill: false }),
      true,
    );
  });

  it("uses the still instead of a blob video when thumbnailUrl / scene exists", () => {
    assert.equal(
      shouldMountThumbVideo({
        previewKind: "thumb",
        hasStill: true,
        inView: true,
      }),
      false,
    );
    assert.equal(
      shouldMountThumbVideo({
        previewKind: "scene",
        hasStill: true,
        inView: true,
      }),
      false,
    );
  });

  it("keeps hover-play only for tiles that are on screen", () => {
    assert.equal(
      shouldMountThumbVideo({
        previewKind: "thumb",
        hasStill: true,
        inView: true,
        hover: true,
      }),
      true,
    );
    assert.equal(
      shouldMountThumbVideo({
        previewKind: "final-video",
        hasStill: false,
        inView: false,
        hover: true,
      }),
      false,
    );
  });

  it("does not mount a card video when the Library player is open for that id", () => {
    assert.equal(
      shouldMountThumbVideo({
        previewKind: "final-video",
        hasStill: false,
        inView: true,
        selected: true,
      }),
      false,
    );
  });
});

describe("Socials thumbs do not render N videos at rest for N > visible", () => {
  it("112 DGX tiles with 8 on screen mount 8 videos, not 112", () => {
    assert.equal(restStateVideoCount(112, 8), 8);
    assert.ok(restStateVideoCount(112, 8) < 112);
    assert.equal(restStateVideoCount(112, 0), 0);
  });

  it("caps concurrent blob mounts so a dense visible window cannot stampede", () => {
    const gate = new BlobVideoGate();
    let granted = 0;
    for (let i = 0; i < 112; i++) {
      const want = shouldMountThumbVideo({
        previewKind: "final-video",
        hasStill: false,
        inView: i < 20,
      });
      if (want && gate.request(`v${i}`)) granted += 1;
    }
    assert.equal(MAX_CONCURRENT_BLOB_VIDEOS, 6);
    assert.equal(granted, 6);
    assert.ok(granted < 20);
    assert.ok(granted < 112);
  });

  it("releases a slot to the next waiter", () => {
    const gate = new BlobVideoGate(2);
    assert.equal(gate.request("a"), true);
    assert.equal(gate.request("b"), true);
    let late = false;
    gate.enqueue("c", () => {
      late = true;
    });
    gate.release("a");
    assert.equal(late, true);
    assert.equal(gate.has("c"), true);
    assert.equal(gate.has("a"), false);
  });

  it("StudioVideoThumb never eager-mounts a raw <video>; LibraryCard uses the gate", async () => {
    const thumb = await readFile(
      "components/animate/screens/socials/StudioVideoThumb.tsx",
      "utf8",
    );
    const library = await readFile("components/vater/youtube-library.tsx", "utf8");
    const lazy = await readFile("components/animate/media/LazyBlobVideo.tsx", "utf8");
    assert.match(thumb, /LazyBlobVideo/);
    assert.match(thumb, /mayMountThumbVideo/);
    assert.equal(/<video[\s\n>]/.test(thumb), false);
    assert.match(library, /LazyBlobVideo/);
    assert.match(library, /mayMountThumbVideo/);
    assert.match(lazy, /IntersectionObserver/);
    assert.match(lazy, /blobVideoGate/);
    assert.match(lazy, /preload/);
  });
});
