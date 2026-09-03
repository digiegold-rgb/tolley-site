import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { firstScenePreviewUrl, libraryCardPreviewKind } from "./library-card-preview.ts";

const librarySrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "components/vater/youtube-library.tsx"),
  "utf8",
);

describe("libraryCardPreviewKind — rest-state Library card", () => {
  it("prefers the permanent poster over every other still", () => {
    assert.equal(
      libraryCardPreviewKind({
        posterUrl: "https://x.public.blob.vercel-storage.com/vater-posters/p.jpg?v=1",
        firstSceneImage: "https://example.com/scene.jpg",
        thumbnailUrl: "https://example.com/thumb.jpg",
        finalVideoUrl: "https://x.blob.vercel-storage.com/final.mp4",
        hasPresetSample: true,
      }),
      "poster",
    );
  });

  it("gives a DGX import with a poster an <img>, never a lazy <video>", () => {
    assert.equal(
      libraryCardPreviewKind({
        posterUrl: "https://x.public.blob.vercel-storage.com/vater-posters/p.jpg?v=1",
        firstSceneImage: null,
        thumbnailUrl: null,
        finalVideoUrl: "https://x.blob.vercel-storage.com/ruthann-112.mp4",
      }),
      "poster",
    );
  });

  it("prefers the first scene still", () => {
    assert.equal(
      libraryCardPreviewKind({
        firstSceneImage: "https://example.com/scene.jpg",
        thumbnailUrl: "https://example.com/thumb.jpg",
        finalVideoUrl: "https://x.blob.vercel-storage.com/final.mp4",
        hasPresetSample: true,
      }),
      "scene",
    );
  });

  it("uses thumbnailUrl when there is no scene still", () => {
    assert.equal(
      libraryCardPreviewKind({
        firstSceneImage: null,
        thumbnailUrl: "https://example.com/thumb.jpg",
        finalVideoUrl: "https://x.blob.vercel-storage.com/final.mp4",
        hasPresetSample: true,
      }),
      "thumb",
    );
  });

  it("uses the final mp4 when thumbnail and scenes are missing (DGX import)", () => {
    assert.equal(
      libraryCardPreviewKind({
        firstSceneImage: null,
        thumbnailUrl: null,
        finalVideoUrl: "https://x.blob.vercel-storage.com/ruthann-112.mp4",
        hasPresetSample: true,
      }),
      "final-video",
    );
  });

  it("treats empty strings as missing", () => {
    assert.equal(
      libraryCardPreviewKind({
        posterUrl: "",
        firstSceneImage: "",
        thumbnailUrl: "",
        finalVideoUrl: "https://x.blob.vercel-storage.com/final.mp4",
        hasPresetSample: true,
      }),
      "final-video",
    );
  });

  it("falls back to the style preset only when there is no finished mp4", () => {
    assert.equal(
      libraryCardPreviewKind({
        firstSceneImage: null,
        thumbnailUrl: null,
        finalVideoUrl: null,
        hasPresetSample: true,
      }),
      "preset",
    );
  });

  it("is empty when nothing is available", () => {
    assert.equal(libraryCardPreviewKind({}), "empty");
  });

  it("firstScenePreviewUrl pins variant=image and the scene version", () => {
    assert.equal(
      firstScenePreviewUrl([{ imageUrl: "https://example.com/s.jpg", version: 2 }]),
      "https://example.com/s.jpg?variant=image&v=2",
    );
    assert.equal(
      firstScenePreviewUrl([{ imageUrl: "https://example.com/s.jpg?x=1", version: 0 }]),
      "https://example.com/s.jpg?x=1&variant=image&v=0",
    );
    assert.equal(firstScenePreviewUrl([]), null);
    assert.equal(firstScenePreviewUrl(null), null);
  });

  it("LibraryCard lazy-mounts a final-video only when the tile is in view", () => {
    assert.match(librarySrc, /libraryCardPreviewKind/);
    assert.match(librarySrc, /firstScenePreviewUrl/);
    assert.match(librarySrc, /mayMountThumbVideo/);
    assert.match(librarySrc, /LazyBlobVideo/);
    assert.match(librarySrc, /preload="metadata"/);
    assert.match(librarySrc, /hoverPreview/);
  });
});
