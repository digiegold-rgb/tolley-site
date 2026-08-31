import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  batchAlreadyBooked,
  flattenInsight,
  matchAnalyticsToPosts,
} from "./match.ts";

describe("flattenInsight", () => {
  it("merges youtube channel + daily bags", () => {
    const m = flattenInsight({
      channel: { subscriberCount: 10, views: 100 },
      daily: { likes: 4 },
    });
    assert.equal(m.followers, 10);
    assert.equal(m.views, 100);
    assert.equal(m.likes, 4);
  });
});

describe("matchAnalyticsToPosts", () => {
  it("joins vendor postId to VaterSocialPost.id", () => {
    const hits = matchAnalyticsToPosts(
      [
        { postId: "z1", views: 9 },
        { _id: "z-missing", views: 1 },
        { views: 2 },
      ],
      [
        { id: "local-1", externalPostId: "z1" },
        { id: "local-2", externalPostId: "other" },
      ],
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0].postId, "local-1");
  });
});

describe("batchAlreadyBooked", () => {
  it("treats any existing row as a retry — do not double-book", () => {
    assert.equal(batchAlreadyBooked(0), false);
    assert.equal(batchAlreadyBooked(1), true);
    assert.equal(batchAlreadyBooked(4), true);
  });
});
