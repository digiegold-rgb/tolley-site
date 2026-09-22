import assert from "node:assert/strict";
import { test } from "node:test";
import { gen2OutputIsVideo } from "./gen2-library";

test("Kling and Seedance outputs remain videos behind the library gate", () => {
  for (const recipe of ["fal-kling-elements", "fal-seedance-ref", "fal-wan-i2v", "fal-wan-stitch"]) {
    assert.equal(gen2OutputIsVideo(recipe, "/api/generate/jobs/a/image?i=0", 0), true);
    assert.equal(gen2OutputIsVideo(recipe, "/api/generate/jobs/a/image?i=1", 1), false);
  }
  assert.equal(gen2OutputIsVideo("fal-qwen-edit", "/api/generate/jobs/a/image?i=0", 0), false);
  assert.equal(gen2OutputIsVideo("fal-wan-i2v", "spark:generate-jobs/a/1.png", 1), false);
  assert.equal(gen2OutputIsVideo(undefined, "https://example.com/export.mp4", 0), true);
});
