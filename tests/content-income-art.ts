import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { renderTip } from "../lib/content-income/art";
import { topicCopy, TOPICS } from "../lib/content-income/catalog";

async function main() {
  const hashes = [];
  for (let i = 0; i < TOPICS.length; i++) {
    const c = topicCopy(i, "image");
    const bytes = await renderTip(c.headline, [...c.points]);
    const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 1080); assert.equal(info.height, 1350);
    let bright = 0;
    for (let y = 210; y < 510; y++) for (let x = 75; x < 1010; x++) {
      const at = (y * info.width + x) * info.channels;
      if (data[at] > 200 && data[at + 1] > 200 && data[at + 2] > 200) bright++;
    }
    assert.ok(bright > 10000, "Headline must contain full-size readable lettering");
    hashes.push(createHash("sha256").update(bytes).digest("hex"));
  }
  await assert.rejects(renderTip("Unsupported \u{10ffff}", ["One", "Two", "Three"]), /unsupported character/);
  console.log(JSON.stringify({ topics: hashes.length, sha256: createHash("sha256").update(hashes.join("")).digest("hex") }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
