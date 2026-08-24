import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPostedToYoutube,
  isPostedToYoutube,
  YOUTUBE_POSTED_AT_KEY,
  YOUTUBE_POSTED_KEY,
} from "./youtube-posted";

describe("isPostedToYoutube", () => {
  it("treats in-app publish id as posted", () => {
    assert.equal(isPostedToYoutube({ youtubeVideoId: "abc123" }), true);
  });

  it("treats publishedAt as posted", () => {
    assert.equal(
      isPostedToYoutube({ publishedAt: "2026-08-20T12:00:00.000Z" }),
      true,
    );
    assert.equal(isPostedToYoutube({ publishedAt: new Date() }), true);
  });

  it("ignores empty publish fields", () => {
    assert.equal(isPostedToYoutube({ youtubeVideoId: "  ", publishedAt: "" }), false);
    assert.equal(isPostedToYoutube({}), false);
  });

  it("honours an explicit manual mark", () => {
    assert.equal(
      isPostedToYoutube({ settingsJson: { [YOUTUBE_POSTED_KEY]: true } }),
      true,
    );
  });

  it("lets an explicit unmark hide an in-app publish", () => {
    assert.equal(
      isPostedToYoutube({
        youtubeVideoId: "abc123",
        publishedAt: "2026-08-20T12:00:00.000Z",
        settingsJson: { [YOUTUBE_POSTED_KEY]: false },
      }),
      false,
    );
  });
});

describe("applyPostedToYoutube", () => {
  it("shallow-merges without dropping other keys", () => {
    const next = applyPostedToYoutube(
      { language: "en", captionPreset: "clean" },
      true,
      new Date("2026-08-24T00:00:00.000Z"),
    );
    assert.equal(next.language, "en");
    assert.equal(next.captionPreset, "clean");
    assert.equal(next[YOUTUBE_POSTED_KEY], true);
    assert.equal(next[YOUTUBE_POSTED_AT_KEY], "2026-08-24T00:00:00.000Z");
  });
});
