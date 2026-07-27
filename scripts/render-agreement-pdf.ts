/**
 * Renders the published client agreement to a static PDF.
 *
 * /estate/agreement is print-styled: `print:hidden` strips the marketing
 * summary and leaves only the paper contract, so a plain print-media render is
 * already the document we want to hand a family. This exists because
 * EstateSales.NET, email attachments, and "send me the contract" all need a
 * real file at a stable URL — window.print() can't provide that.
 *
 * Re-run whenever lib/estate-agreement.ts changes:
 *   npx tsx scripts/render-agreement-pdf.ts
 *   npx tsx scripts/render-agreement-pdf.ts http://localhost:3000
 */

import path from "node:path";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "https://www.tolley.io";
const SOURCE = `${BASE}/estate/agreement`;
const OUT = path.join(process.cwd(), "public/estate/tolley-estate-sales-agreement.pdf");

async function main() {
  console.log(`[agreement-pdf] rendering ${SOURCE}`);
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    const res = await page.goto(SOURCE, { waitUntil: "networkidle", timeout: 60_000 });
    if (!res || !res.ok()) {
      throw new Error(`${SOURCE} returned ${res ? res.status() : "no response"}`);
    }

    // The contract block is the print target — if it's missing, the page
    // changed shape and the PDF would silently be a blank marketing page.
    const contract = page.locator("#contract");
    if ((await contract.count()) === 0) {
      throw new Error("#contract not found — check app/estate/agreement/page.tsx");
    }

    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: OUT,
      format: "Letter",
      printBackground: true,
      margin: { top: "0.6in", bottom: "0.6in", left: "0.6in", right: "0.6in" },
    });
  } finally {
    await browser.close();
  }

  console.log(`[agreement-pdf] wrote ${OUT}`);
}

main().catch((err) => {
  console.error("[agreement-pdf] failed:", err.message);
  process.exit(1);
});
