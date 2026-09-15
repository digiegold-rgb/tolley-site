import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NEBIUS_RUNTIME_SEC } from "./gpu-router.ts";
import {
  routeAnimateGpuJob,
  routeFilmProduceGpuJob,
  routeListingGpuJob,
  routeStudioGenerateGpuJob,
  routeVideoGenerateGpuJob,
} from "./gpu-job-kind.ts";

describe("surface GPU kinds", () => {
  it("routes typical Animate clips to Modal short-motion", () => {
    const wan = routeAnimateGpuJob("~5 min");
    assert.equal(wan.backend, "modal");
    assert.equal(wan.kind, "short-motion");
    assert.match(wan.reason, /Modal short path/);
  });

  it("keeps produce-without-animation as stills and long films as long-video", () => {
    const stills = routeFilmProduceGpuJob({ targetDurationMin: 10, animUntilS: null });
    assert.equal(stills.kind, "still");
    assert.equal(stills.backend, "modal");

    const hybrid = routeFilmProduceGpuJob({ targetDurationMin: 10, animUntilS: 30 });
    assert.equal(hybrid.kind, "short-motion");
    assert.equal(hybrid.backend, "modal");

    const long = routeFilmProduceGpuJob({
      targetDurationMin: NEBIUS_RUNTIME_SEC / 60,
      animUntilS: 30,
    });
    assert.equal(long.kind, "long-video");
    assert.equal(long.backend, "nebius");
  });

  it("maps listing stills vs videos by SKU length", () => {
    const staging = routeListingGpuJob({ skuKind: "still", etaLabel: "about 1 minute" });
    assert.equal(staging.kind, "still");
    assert.equal(staging.backend, "modal");

    const beauty = routeListingGpuJob({
      skuKind: "video",
      etaLabel: "about 4 minutes",
      durationS: 12,
    });
    assert.equal(beauty.kind, "short-motion");
    assert.equal(beauty.backend, "modal");
  });

  it("maps realestate /video/generate tiers by clip length", () => {
    const basic = routeVideoGenerateGpuJob({
      duration: "5 seconds",
      estimatedTime: "~30 seconds",
    });
    assert.equal(basic.kind, "short-motion");
    assert.equal(basic.backend, "modal");

    const studioImage = routeStudioGenerateGpuJob("image");
    assert.equal(studioImage.kind, "still");
    assert.equal(studioImage.backend, "modal");

    const studioVideo = routeStudioGenerateGpuJob("video");
    assert.equal(studioVideo.kind, "short-motion");
    assert.equal(studioVideo.backend, "modal");
  });
});
