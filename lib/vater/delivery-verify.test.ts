import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { probeFinalVideo } from "./delivery-ready";

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("probeFinalVideo", () => {
  it("accepts HEAD 200 video/* with nonzero length", async () => {
    const probe = await probeFinalVideo(
      "https://example.blob.vercel-storage.com/vater-finals/x.mp4",
      async () =>
        new Response(null, {
          status: 200,
          headers: headers({ "content-type": "video/mp4", "content-length": "83210240" }),
        }),
    );
    assert.equal(probe.ok, true);
    assert.equal(probe.contentLength, 83210240);
    assert.equal(probe.contentType, "video/mp4");
  });

  it("rejects missing length, non-video, and non-https", async () => {
    const zero = await probeFinalVideo(
      "https://example.blob.vercel-storage.com/vater-finals/x.mp4",
      async () =>
        new Response(null, {
          status: 200,
          headers: headers({ "content-type": "video/mp4", "content-length": "0" }),
        }),
    );
    assert.equal(zero.ok, false);
    assert.equal(zero.reason, "zero_length");

    const html = await probeFinalVideo(
      "https://example.blob.vercel-storage.com/vater-finals/x.mp4",
      async () =>
        new Response(null, {
          status: 200,
          headers: headers({ "content-type": "text/html", "content-length": "12" }),
        }),
    );
    assert.equal(html.ok, false);
    assert.equal(html.reason, "not_video");

    const rel = await probeFinalVideo("/vater/file/abc/video");
    assert.equal(rel.ok, false);
    assert.equal(rel.reason, "not_https");
  });
});
