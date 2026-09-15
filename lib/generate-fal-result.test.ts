import assert from "node:assert/strict";
import { it } from "node:test";
import { fal } from "@fal-ai/client";
import { getImageResult } from "./fal";
it("fal image polling retains every output in a batch", async () => {
  const original = fal.queue.result;
  fal.queue.result = async () => ({ data: { images: [{ url: "https://example.com/one.png" }, { url: "https://example.com/two.png" }, { url: "https://example.com/three.png" }] }, requestId: "local-test" });
  try {
    const result = await getImageResult("flux2-edit", "local-test");
    assert.deepEqual(result.imageUrls, ["https://example.com/one.png", "https://example.com/two.png", "https://example.com/three.png"]);
    assert.equal(result.imageUrl, result.imageUrls[0]);
  } finally { fal.queue.result = original; }
});
