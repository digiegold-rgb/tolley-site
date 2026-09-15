import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serializeJob } from "./generate-job-store.ts";

describe("serializeJob", () => {
  it("never returns a public Blob CDN URL to the client", () => {
    const now = new Date("2026-09-05T00:00:00.000Z");
    const json = serializeJob({
      id: "clxyz",
      status: "done",
      recipe: "qwen-image-edit-2511",
      cardJson: { prompt: "x" },
      modalCallId: "fc-1",
      outputUrls: [
        "https://7c7wlwtbdnayflas.public.blob.vercel-storage.com/generate/clxyz/0.png",
        "spark:generate-jobs/clxyz/1.png",
      ],
      error: null,
      createdBy: "hq:tolley",
      startedAt: now,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
      backend: "modal",
      kind: "still",
      durationMs: 18400,
      costUsd: 0.0412,
    });
    assert.deepEqual(json.output_urls, [
      "/api/generate/jobs/clxyz/image?i=0",
      "/api/generate/jobs/clxyz/image?i=1",
    ]);
    assert.equal(json.backend, "modal");
    assert.equal(json.kind, "still");
    assert.equal(json.durationMs, 18400);
    assert.equal(json.costUsd, 0.0412);
    assert.equal(JSON.stringify(json).includes("public.blob.vercel-storage"), false);
    assert.equal(JSON.stringify(json).includes("spark:"), false);
  });

  it("defaults GPU log fields when a constructed row omits them", () => {
    const now = new Date("2026-09-15T00:00:00.000Z");
    const json = serializeJob({
      id: "c1",
      status: "running",
      recipe: "qwen-image-edit-2511",
      cardJson: {},
      modalCallId: null,
      outputUrls: [],
      error: null,
      createdBy: "hq:tolley",
      startedAt: now,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    assert.equal(json.backend, "modal");
    assert.equal(json.kind, null);
    assert.equal(json.durationMs, null);
    assert.equal(json.costUsd, null);
  });
});
