import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bufferLooksLikeMp4,
  inferMediaContentType,
  parseBytesRange,
  serveMediaBytes,
} from "./generate-media.ts";
import { sparkOutputRef } from "./generate-output.ts";

describe("inferMediaContentType", () => {
  it("prefers video/mp4 for clips and never defaults an mp4 to image/png", () => {
    const ftyp = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    assert.equal(bufferLooksLikeMp4(ftyp), true);
    assert.equal(inferMediaContentType({ body: ftyp, fetchedType: "image/png" }), "video/mp4");
    assert.equal(
      inferMediaContentType({ stored: "https://v3.fal.media/files/x.mp4", fetchedType: "" }),
      "video/mp4",
    );
    assert.equal(inferMediaContentType({ stored: sparkOutputRef("j", 0, "mp4") }), "video/mp4");
    assert.equal(inferMediaContentType({ fetchedType: "image/png" }), "image/png");
  });
});

describe("serveMediaBytes Range", () => {
  it("returns 206 with Content-Range for a valid bytes range", () => {
    const body = Buffer.from("0123456789");
    const whole = serveMediaBytes({ body, contentType: "video/mp4" });
    assert.equal(whole.status, 200);
    assert.equal(whole.headers["Accept-Ranges"], "bytes");
    assert.equal(whole.headers["Content-Type"], "video/mp4");
    const part = serveMediaBytes({ body, contentType: "video/mp4", rangeHeader: "bytes=2-5" });
    assert.equal(part.status, 206);
    assert.equal(part.body.toString(), "2345");
    assert.equal(part.headers["Content-Range"], "bytes 2-5/10");
    assert.deepEqual(parseBytesRange("bytes=8-", 10), { start: 8, end: 9 });
  });
});
