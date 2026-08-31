import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeMetrics,
  parseMetrics,
  vendorPostIdOf,
  utcMidnight,
  EMPTY_METRICS,
} from "./metrics.ts";

describe("parseMetrics", () => {
  it("returns empty for null / non-objects", () => {
    assert.deepEqual(parseMetrics(null), EMPTY_METRICS);
    assert.deepEqual(parseMetrics("x"), EMPTY_METRICS);
    assert.deepEqual(parseMetrics([]), EMPTY_METRICS);
  });

  it("reads optional top-level fields and ignores missing ones", () => {
    const m = parseMetrics({ views: 12, likes: "3", comments: 0 });
    assert.equal(m.views, 12);
    assert.equal(m.likes, 3);
    assert.equal(m.comments, 0);
    assert.equal(m.followers, null);
    assert.equal(m.shares, null);
  });

  it("accepts vendor aliases and nested metrics bags", () => {
    const m = parseMetrics({
      followerCount: 100,
      metrics: {
        viewCount: 50,
        estimatedMinutesWatched: 2,
        impressions: 9,
      },
    });
    assert.equal(m.followers, 100);
    assert.equal(m.views, 50);
    assert.equal(m.watchTimeSec, 120);
    assert.equal(m.impressions, 9);
  });

  it("accepts bigint without throwing", () => {
    const m = parseMetrics({ views: 10n, likes: 2n });
    assert.equal(m.views, 10);
    assert.equal(m.likes, 2);
  });
});

describe("mergeMetrics", () => {
  it("later non-null fields win", () => {
    const a = parseMetrics({ views: 1, likes: 2 });
    const b = parseMetrics({ likes: 9, followers: 4 });
    const m = mergeMetrics(a, b);
    assert.equal(m.views, 1);
    assert.equal(m.likes, 9);
    assert.equal(m.followers, 4);
  });
});

describe("vendorPostIdOf", () => {
  it("reads postId / _id / nested post", () => {
    assert.equal(vendorPostIdOf({ postId: "abc" }), "abc");
    assert.equal(vendorPostIdOf({ _id: "z1" }), "z1");
    assert.equal(vendorPostIdOf({ post: { _id: "nested" } }), "nested");
    assert.equal(vendorPostIdOf({}), null);
  });
});

describe("utcMidnight", () => {
  it("clamps to UTC midnight", () => {
    const d = utcMidnight(new Date("2026-08-30T15:45:00.000Z"));
    assert.equal(d.toISOString(), "2026-08-30T00:00:00.000Z");
  });
});
