#!/usr/bin/env node
/* Measures the 1C mark's text layout the way chromium actually lays it out, so
 * the vector build can place outlined glyphs at identical positions instead of
 * guessing at line-box maths.
 *
 * Per line we report:
 *   left      shrink-to-fit box left edge (where the glyph run starts)
 *   baseline  y of the alphabetic baseline
 *   advances  cumulative x offset per character, measured with the SAME font
 *             and letter-spacing as the DOM, so kerning and tracking are real
 *
 * Everything is measured on the 340x340 reference canvas from the handoff.
 * Emits JSON on stdout.
 */
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--force-color-profile=srgb"] });
const page = await browser.newPage({ viewport: { width: 700, height: 500 }, deviceScaleFactor: 1 });
await page.goto("file://" + path.join(HERE, "ref-1c.html"), { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);

const data = await page.evaluate(() => {
  const out = { canvas: 340, lines: [] };
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d");

  for (const el of document.querySelectorAll("[data-measure]")) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const host = el.closest(".mark").getBoundingClientRect();
    const text = el.textContent;

    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
    const m = ctx.measureText(text);
    const asc = m.fontBoundingBoxAscent;
    const desc = m.fontBoundingBoxDescent;

    // Chrome centres the (ascent+descent) content box inside the line box and
    // puts the baseline at half-leading + ascent from the block's top edge.
    // line-height:normal has no numeric computed value to parse — in that case
    // the content box IS the line box, so half-leading is zero.
    const lineHeight = cs.lineHeight === "normal" ? asc + desc : parseFloat(cs.lineHeight);
    const baseline = rect.top - host.top + (lineHeight - (asc + desc)) / 2 + asc;

    // Per-glyph pen positions from the SVG twin. measureText(prefix) is wrong
    // here: it cannot apply the kern pair between the prefix's last character
    // and the one after it, which pushed JELLY's Y out of place.
    const probe = document.getElementById("p-" + el.dataset.measure);
    const x0 = probe.getStartPositionOfChar(0).x;
    const advances = [];
    for (let i = 0; i < text.length; i++) {
      advances.push(probe.getStartPositionOfChar(i).x - x0);
    }

    out.lines.push({
      id: el.dataset.measure,
      text,
      font: cs.fontFamily.split(",")[0].replace(/["']/g, ""),
      weight: cs.fontWeight,
      fontSize: parseFloat(cs.fontSize),
      letterSpacing: cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing),
      lineHeight,
      ascent: asc,
      descent: desc,
      opacity: parseFloat(cs.opacity),
      left: rect.left - host.left,
      width: rect.width,
      baseline,
      advances,
    });
  }
  return out;
});

console.log(JSON.stringify(data, null, 2));
await browser.close();
