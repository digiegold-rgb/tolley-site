import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listingDeliveryError, listingStartPlan, needsListingDeliveryRecovery } from "./delivery";

const photo = "https://example.com/staged.png";
const labeled = "https://example.com/staged-labeled.png";
const video = "https://example.com/video.mp4";

describe("listing delivery contract", () => {
  it("starts Beauty Shot as video without a furnishing/approval job", () => {
    assert.deepEqual(listingStartPlan("beauty_shot"), { dgxSku: "beauty", status: "rendering" });
    assert.deepEqual(listingStartPlan("before_after"), { dgxSku: "staging", status: "staging" });
    assert.deepEqual(listingStartPlan("virtual_staging"), { dgxSku: "staging", status: "staging" });
    assert.throws(() => listingStartPlan("walkthrough"));
  });
  it("rejects the exact done-but-all-uploads-null response", () => {
    assert.match(listingDeliveryError("staging", {
      originalUrl: null, stagedStillUrl: null, stagedStillLabeledUrl: null,
      thumbnailUrl: null, proof: { originalUrl: null, stagedUrl: null },
    })!, /could not be delivered/);
  });
  it("requires both the source for rendering and the labeled approval preview", () => {
    for (const assets of [undefined, {}, { originalUrl: photo }, { stagedStillUrl: photo },
      { stagedStillLabeledUrl: labeled }, { stagedStillUrl: " ", stagedStillLabeledUrl: labeled }]) {
      assert.notEqual(listingDeliveryError("staging", assets), null);
    }
    assert.equal(listingDeliveryError("staging", { stagedStillUrl: photo, stagedStillLabeledUrl: labeled }), null);
  });
  it("requires a real video URL, not a thumbnail, for video success", () => {
    assert.notEqual(listingDeliveryError("rendering", { thumbnailUrl: photo }), null);
    assert.notEqual(listingDeliveryError("rendering", { videoUrl: "javascript:alert(1)" }), null);
    assert.equal(listingDeliveryError("rendering", { videoUrl: video }), null);
    assert.notEqual(listingDeliveryError("finishing", {}), null);
    assert.equal(listingDeliveryError("finishing", { videoVerticalUrl: video }), null);
  });
  it("rechecks stranded reveal approvals but lets legacy Beauty use its original", () => {
    assert.equal(needsListingDeliveryRecovery({ status: "awaiting_approval", sku: "before_after" }), true);
    assert.equal(needsListingDeliveryRecovery({ status: "awaiting_approval", sku: "beauty_shot" }), false);
    assert.equal(needsListingDeliveryRecovery({ status: "awaiting_approval", sku: "before_after", stagedStillUrl: photo, stagedStillLabeledUrl: labeled }), false);
    assert.equal(needsListingDeliveryRecovery({ status: "rendering", sku: "before_after" }), false);
  });
});
