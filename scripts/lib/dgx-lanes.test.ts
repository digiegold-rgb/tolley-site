import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  dedupeKey,
  discoverLaneClips,
  missingExactNames,
  parseLaneFlag,
  parsePostedJson,
  titleFromSidecar,
} from "./dgx-lanes.ts";

describe("dedupeKey", () => {
  it("is dgx:<lane>:<stem>", () => {
    assert.equal(dedupeKey("ruthann", "clip-01"), "dgx:ruthann:clip-01");
    assert.equal(dedupeKey("cinema", "my-project"), "dgx:cinema:my-project");
  });
});

describe("parseLaneFlag", () => {
  it("defaults to all lanes", () => {
    assert.deepEqual(parseLaneFlag(undefined), [
      "ruthann",
      "estate",
      "wd",
      "housing",
      "cinema",
    ]);
  });
  it("accepts a comma list and W/D alias", () => {
    assert.deepEqual(parseLaneFlag("ruthann,W/D"), ["ruthann", "wd"]);
  });
  it("rejects unknown lanes", () => {
    assert.throws(() => parseLaneFlag("nope"), /Unknown --lane/);
  });
});

describe("parsePostedJson", () => {
  it("reads arrays, nested posted[], and truthy maps", () => {
    assert.ok(parsePostedJson(["a.mp4", "b"]).has("a"));
    assert.ok(parsePostedJson({ posted: ["foo.mp4"] }).has("foo"));
    assert.ok(parsePostedJson({ clip: true }).has("clip"));
  });
});

describe("titleFromSidecar", () => {
  it("prefers title then falls back", () => {
    assert.equal(titleFromSidecar({ title: "Hello" }, "x"), "Hello");
    assert.equal(titleFromSidecar({ topic: "T" }, "x"), "T");
    assert.equal(titleFromSidecar({}, "stem name"), "stem name");
  });
});

describe("missingExactNames", () => {
  it("is exact and case-sensitive", () => {
    assert.deepEqual(missingExactNames(["Ruthann", "estate"], ["Ruthann", "Estate"]), [
      "Estate",
    ]);
    assert.deepEqual(missingExactNames(["Ruthann", "Estate", "W/D", "Housing", "Cinema"], [
      "Ruthann",
      "Estate",
      "W/D",
      "Housing",
      "Cinema",
    ]), []);
  });
});

describe("discoverLaneClips", () => {
  it("walks the documented globs and cinema stem = project dir", () => {
    const home = join(tmpdir(), `dgx-lanes-${process.pid}-${Date.now()}`);
    mkdirSync(join(home, "growth-engine/shorts/review"), { recursive: true });
    mkdirSync(join(home, "growth-engine/cinema/projects/sunset-cut"), { recursive: true });
    mkdirSync(join(home, "housing-hub/out/2026-08-30"), { recursive: true });
    writeFileSync(join(home, "growth-engine/shorts/review/hello.mp4"), "x");
    writeFileSync(
      join(home, "growth-engine/shorts/review/posted.json"),
      JSON.stringify(["hello.mp4"]),
    );
    writeFileSync(join(home, "growth-engine/cinema/projects/sunset-cut/final.mp4"), "x");
    writeFileSync(
      join(home, "growth-engine/cinema/projects/sunset-cut/final.json"),
      JSON.stringify({ title: "Sunset" }),
    );
    writeFileSync(join(home, "housing-hub/out/2026-08-30/lot-9.mp4"), "x");
    writeFileSync(
      join(home, "housing-hub/out/2026-08-30/lot-9.json"),
      JSON.stringify({ headline: "Lot 9" }),
    );
    try {
      const ruth = discoverLaneClips(home, "ruthann");
      assert.equal(ruth.length, 1);
      assert.equal(ruth[0].key, "dgx:ruthann:hello");
      assert.equal(ruth[0].posted, true);

      const cinema = discoverLaneClips(home, "cinema");
      assert.equal(cinema.length, 1);
      assert.equal(cinema[0].stem, "sunset-cut");
      assert.equal(cinema[0].title, "Sunset");
      assert.equal(cinema[0].key, "dgx:cinema:sunset-cut");

      const housing = discoverLaneClips(home, "housing");
      assert.equal(housing.length, 1);
      assert.equal(housing[0].title, "Lot 9");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
