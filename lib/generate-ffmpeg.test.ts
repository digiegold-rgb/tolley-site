import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { concatMp4s, isFfmpegAvailable, playbackRateForSlowMo, remuxSlowMo, slowMoLabel } from "./generate-ffmpeg.ts";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
  });
}

describe("slow-mo labels", () => {
  it("uses playbackRate 0.5 only when remux did not land", () => {
    assert.equal(slowMoLabel(true), "0.5× slow-mo");
    assert.equal(playbackRateForSlowMo(true, false), 0.5);
    assert.equal(playbackRateForSlowMo(true, true), 1);
    assert.equal(playbackRateForSlowMo(false, false), 1);
  });
});

describe("ffmpeg remux + concat", () => {
  it("remuxes 0.5× and concats two tiny clips when ffmpeg is on PATH", async () => {
    const avail = await isFfmpegAvailable();
    if (!avail.ok) {
      assert.ok(avail.error);
      return;
    }
    const dir = await mkdtemp(join(tmpdir(), "gen-ff-test-"));
    try {
      const a = join(dir, "a.mp4");
      const b = join(dir, "b.mp4");
      await run(avail.bin, [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=64x64:d=0.5",
        "-pix_fmt",
        "yuv420p",
        a,
      ]);
      await run(avail.bin, [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=64x64:d=0.5",
        "-pix_fmt",
        "yuv420p",
        b,
      ]);
      const slow = await remuxSlowMo(await readFile(a));
      assert.ok(slow.length > 100);
      const stitched = await concatMp4s([await readFile(a), await readFile(b)]);
      assert.ok(stitched.length > 100);
      await writeFile(join(dir, "out.mp4"), stitched);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
