import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";

import {
  classifyStillSource,
  isFragileThumbUrl,
  isPermanentStillPath,
  PERMANENT_STILL_CACHE_CONTROL,
  pickExistingStillSource,
  permanentStillUrl,
  stillBlobKey,
} from "./permanent-still.ts";

describe("permanent still URLs are stable and never signed", () => {
  it("uses one path per youtube / listing id", () => {
    assert.equal(permanentStillUrl("youtube", "p1"), "/api/vater/youtube/p1/still");
    assert.equal(permanentStillUrl("listing", "L1"), "/api/vater/listing/L1/still");
    assert.equal(permanentStillUrl("youtube", ""), "");
    assert.equal(stillBlobKey("youtube", "p1"), "animate-stills/youtube/p1.jpg");
    assert.equal(stillBlobKey("listing", "L1"), "animate-stills/listing/L1.jpg");
  });

  it("marks expiring / dead srcs as fragile", () => {
    assert.equal(isFragileThumbUrl(null), true);
    assert.equal(isFragileThumbUrl(""), true);
    assert.equal(isFragileThumbUrl("blob:https://tolley.io/abc"), true);
    assert.equal(
      isFragileThumbUrl("https://img.youtube.com/vi/abc/mqdefault.jpg"),
      true,
    );
    assert.equal(
      isFragileThumbUrl("https://r2.example/x.jpg?X-Amz-Expires=3600&X-Amz-Signature=z"),
      true,
    );
    assert.equal(isFragileThumbUrl("/api/vater/youtube/p1/still"), false);
    assert.equal(isFragileThumbUrl("/api/vater/file/style/s/front.jpg"), false);
    assert.equal(isFragileThumbUrl("https://x.blob.vercel-storage.com/a.jpg"), false);
  });

  it("never copies the still route or an mp4 as the source file", () => {
    assert.equal(
      pickExistingStillSource({
        thumbnailUrl: "/api/vater/youtube/p1/still",
        firstSceneImage: "/api/vater/youtube/p1/scene/0?variant=image&v=0",
      }),
      "/api/vater/youtube/p1/scene/0?variant=image&v=0",
    );
    assert.equal(
      pickExistingStillSource({
        thumbnailUrl: "https://x.blob.vercel-storage.com/final.mp4",
        firstSceneImage: null,
      }),
      null,
    );
    assert.equal(
      pickExistingStillSource({
        stagedStillLabeledUrl: "https://blob/labeled.jpg",
        stagedStillUrl: "https://blob/bare.jpg",
      }),
      "https://blob/labeled.jpg",
    );
  });

  it("classifies persist work so we never spend GPU on a card thumb", () => {
    assert.equal(classifyStillSource({ hasPersisted: true }), "persisted");
    assert.equal(
      classifyStillSource({ thumbnailUrl: "https://x/thumb.jpg" }),
      "thumbnail",
    );
    assert.equal(
      classifyStillSource({
        firstSceneImage: "/api/vater/youtube/p/scene/0?variant=image&v=0",
      }),
      "scene",
    );
    assert.equal(
      classifyStillSource({
        finalVideoUrl: "https://x.blob.vercel-storage.com/a.mp4",
      }),
      "frame",
    );
    assert.equal(classifyStillSource({}), "none");
  });

  it("immutable cache header — browser keeps the still forever", () => {
    assert.match(PERMANENT_STILL_CACHE_CONTROL, /max-age=31536000/);
    assert.match(PERMANENT_STILL_CACHE_CONTROL, /immutable/);
  });
});

describe("Animate grids use the permanent still helper, not a rest-state mp4", () => {
  it("StudioVideoThumb paints an <img> from the stable still URL", async () => {
    const thumb = await readFile(
      "components/animate/screens/socials/StudioVideoThumb.tsx",
      "utf8",
    );
    assert.match(thumb, /PermanentStill/);
    assert.match(thumb, /permanentStillUrl/);
    assert.equal(/LazyBlobVideo/.test(thumb), false);
    assert.equal(/<video[\s\n>]/.test(thumb), false);
    assert.equal(/img\.youtube\.com/.test(thumb), false);
  });

  it("Library rest-state is the same still; hover may still play", async () => {
    const library = await readFile("components/vater/youtube-library.tsx", "utf8");
    assert.match(library, /PermanentStill/);
    assert.match(library, /permanentStillUrl/);
    assert.match(library, /hoverPreview/);
  });

  it("listing + history + shorts + project cards share the helper", async () => {
    const files = [
      "components/animate/screens/listing/ListingLibrary.tsx",
      "components/animate/screens/browse/ProjectHistoryScreen.tsx",
      "components/animate/screens/studio/ShortsLibrary.tsx",
      "components/vater/youtube-project-card.tsx",
    ];
    for (const file of files) {
      const src = await readFile(file, "utf8");
      assert.match(src, /PermanentStill|permanentStillUrl/, file);
    }
  });

  it("GET still routes exist and cache immutable", async () => {
    const yt = await readFile("app/api/vater/youtube/[id]/still/route.ts", "utf8");
    const listing = await readFile(
      "app/api/vater/listing/[id]/still/route.ts",
      "utf8",
    );
    assert.match(yt, /PERMANENT_STILL_CACHE_CONTROL/);
    assert.match(yt, /ensurePermanentStill/);
    assert.match(listing, /ensurePermanentStill/);
    assert.equal(/generateThumbnail/.test(yt), false);
  });
});
