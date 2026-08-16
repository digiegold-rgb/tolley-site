/* Renders an outlined SVG at a given size and writes a PNG, so the vector can be
 * pixel-diffed against Jared's reference raster.
 * The wrapper HTML is written next to the SVG: a file:// <img> inside an
 * about:blank setContent page is blocked as a cross-origin load and silently
 * renders as a broken-image icon. */
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";
const [svg, out, size] = process.argv.slice(2);
const abs = path.resolve(svg);
const wrap = path.join(path.dirname(abs), `.verify-${path.basename(abs)}.html`);
fs.writeFileSync(wrap, `<style>html,body{margin:0;padding:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="${path.basename(abs)}">`);
const b = await chromium.launch({ args: ["--force-color-profile=srgb"] });
const p = await b.newPage({ viewport: { width: +size, height: +size }, deviceScaleFactor: 1 });
await p.goto("file://" + wrap, { waitUntil: "networkidle" });
await p.waitForTimeout(200);
await p.screenshot({ path: out, type: "png", omitBackground: true });
await b.close();
fs.unlinkSync(wrap);
console.log("rendered", out);
