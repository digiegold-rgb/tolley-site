import type { Browser, Page, Response } from "playwright";
import { pathToFileURL } from "node:url";
import { prisma } from "../../../lib/prisma";
import { parseWhatnotSchedule } from "../../../lib/live/schedule-core";
import { reconcileWhatnotSchedule } from "../../../lib/live/schedule-sync";
import { ensureImpactLink } from "../../../lib/live/impact";

// Reuse the signed-in desktop session. Never copy cookies or log GraphQL bodies:
// the dashboard's other response branches may contain private stream credentials.
async function main() {
let browser: Browser | undefined;
let page: Page | undefined;
try {
  const { chromium } = await import(pathToFileURL(process.env.WHATNOT_PLAYWRIGHT || "/home/jelly/tolley-game-release/node_modules/playwright/index.mjs").href);
  browser = await chromium.connectOverCDP(process.env.WHATNOT_CDP || "http://127.0.0.1:9222", { timeout: 15000 });
  const p = await browser!.contexts()[0].newPage(); page = p;
  const waiting = p.waitForResponse((r: Response) => {
    const url = new URL(r.url());
    return url.origin === "https://www.whatnot.com" && url.pathname === "/services/graphql/" && url.searchParams.get("operationName") === "GetDashboardLivestreamsByUserId";
  }, { timeout: 60000 });
  // Install a rejection handler immediately, including when navigation itself fails.
  waiting.catch(() => {});
  await p.goto("https://www.whatnot.com/dashboard/lives", { waitUntil: "domcontentloaded", timeout: 45000 });
  const r = await waiting;
  if (!r.ok() || !/^https:\/\/www\.whatnot\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?dashboard\/lives\/?$/.test(p.url())) throw new Error("Seller Hub session unavailable");
  const observedAt = new Date();
  const shows = parseWhatnotSchedule(await r.json(), r.request().postDataJSON()?.variables?.sellerId, observedAt).sort((a,b) => +a.startsAt - +b.startsAt);
  if (process.argv.includes("--dry-run")) console.log(JSON.stringify({ status: "verified", observedAt, shows }));
  else {
    const result = await reconcileWhatnotSchedule(shows, observedAt);
    let affiliateErrors = 0;
    for (const show of shows) try { await ensureImpactLink(show.whatnotUrl, `show_${show.id}`); } catch { affiliateErrors++; }
    console.log(JSON.stringify({ ...result, affiliateErrors }));
  }
} catch {
  const meta = { status: "error", message: "Could not verify the complete Whatnot schedule. Check the saved Seller Hub session; existing shows are not canceled on a failed read." };
  if (!process.argv.includes("--dry-run")) await prisma.siteEvent.create({ data: { site: "live", path: "/stream/growth", event: "whatnot_schedule_sync", meta } }).catch(() => {});
  console.error(JSON.stringify(meta)); process.exitCode = 1;
} finally {
  await page?.close().catch(() => {});
  // Playwright CDP browser.close disconnects this client; it does not close the shared browser.
  await browser?.close().catch(() => {});
  await prisma.$disconnect();
}

}
void main();
