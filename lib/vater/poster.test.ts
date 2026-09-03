import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  finalVersionTag,
  posterFrameTime,
  posterNeedsRefresh,
  posterScaleFilter,
  posterUrlFor,
  posterVersionTag,
} from "./poster.ts";

const BLOB = "https://abc.public.blob.vercel-storage.com/vater-finals/p1.mp4?v=1756437000";

describe("poster — permanent tile stills", () => {
  it("reads the final's ?v= as its version tag", () => {
    assert.equal(finalVersionTag(BLOB), "1756437000");
  });

  it("hashes finals that carry no cache-buster so re-uploads still refresh", () => {
    const a = finalVersionTag("https://abc.public.blob.vercel-storage.com/vater-finals/a.mp4");
    const b = finalVersionTag("https://abc.public.blob.vercel-storage.com/vater-finals/b.mp4");
    assert.ok(a && a.startsWith("h"));
    assert.notEqual(a, b);
  });

  it("needs a poster when none is stored", () => {
    assert.equal(posterNeedsRefresh({ finalVideoUrl: BLOB, posterUrl: null }), true);
  });

  it("is satisfied by a poster pinned to the same final version", () => {
    const poster = posterUrlFor("https://abc.public.blob.vercel-storage.com/vater-posters/p1.jpg", BLOB);
    assert.equal(poster, "https://abc.public.blob.vercel-storage.com/vater-posters/p1.jpg?v=1756437000");
    assert.equal(posterVersionTag(poster), "1756437000");
    assert.equal(posterNeedsRefresh({ finalVideoUrl: BLOB, posterUrl: poster }), false);
  });

  it("refreshes after a re-compose bumps the final's version", () => {
    const poster = posterUrlFor("https://abc.public.blob.vercel-storage.com/vater-posters/p1.jpg", BLOB);
    assert.equal(
      posterNeedsRefresh({ finalVideoUrl: BLOB.replace("1756437000", "1756500000"), posterUrl: poster }),
      true,
    );
  });

  it("skips finals that are not public blob URLs (DGX proxy paths)", () => {
    assert.equal(posterNeedsRefresh({ finalVideoUrl: "/api/vater/youtube/p1/video", posterUrl: null }), false);
    assert.equal(posterNeedsRefresh({ finalVideoUrl: null, posterUrl: null }), false);
  });

  it("picks a frame past the fade-in and never past 40% of a short clip", () => {
    const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
    near(posterFrameTime(null), 1.2);
    near(posterFrameTime(60), 3);
    near(posterFrameTime(12), 1.8);
    near(posterFrameTime(5), 1.2);
    near(posterFrameTime(2), 0.8);
  });

  it("scales the long edge only", () => {
    assert.match(posterScaleFilter(640), /640/);
    assert.match(posterScaleFilter(640), /-2/);
  });
});
