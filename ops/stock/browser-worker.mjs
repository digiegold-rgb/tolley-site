import { chromium } from "playwright";

// Shared by tests and any future interactive collector: never click without this gate.
export function pacedBrowser(
  page,
  now = () => Date.now(),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
) {
  let lastAction = now();
  async function wait() {
    const delay = Math.max(0, 3100 - (now() - lastAction));
    if (delay) await sleep(delay);
  }
  return {
    async click(locator) {
      await wait();
      await locator.click();
      lastAction = now();
    },
    async goto(url) {
      await wait();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      lastAction = now();
    },
  };
}
async function api(path, body) {
  const response = await fetch(
    `${process.env.STOCK_BASE_URL}/api/stock/worker/${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${process.env.STOCK_WORKER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!response.ok) throw new Error(`Stock API ${response.status}`);
  return response.json();
}
export function listingObservation(text, title) {
  // Do not infer bid from MSRP or manifest values. Only accept explicitly labeled bids.
  const bid = text.match(
    /(?:Current Bid|Winning Bid|Starting Bid)\s*\n\s*\$([\d,]+(?:\.\d{2})?)/i,
  );
  const nextBid = text.match(/Enter Max Bid\s*\(\$([\d,]+(?:\.\d{2})?)\+/i);
  const closing = text.match(/End Date & Time:\s*([^\n]+)/i)?.[1];
  const ends = closing ? new Date(closing) : null;
  const evaluated = nextBid || bid;
  return {
    title: title.slice(0, 500),
    bidCents: evaluated
      ? Math.round(Number(evaluated[1].replaceAll(",", "")) * 100)
      : null,
    ...(ends && Number.isFinite(ends.getTime())
      ? { endsAt: ends.toISOString() }
      : {}),
    notes:
      "Bid to evaluate uses the next required bid when shown, otherwise the observed price. Verify shipping, fees, close time, and pickup on the supplier page before buying.",
  };
}
async function main() {
  let browser, page;
  try {
    const listings = await api("watchlist");
    if (!listings.length) {
      await api("status", {
        id: "browser",
        status: "ok",
        message: "No watched B-Stock listings require refresh.",
      });
      return;
    }
    browser = await chromium.connectOverCDP(
      process.env.STOCK_BROWSER_CDP || "http://127.0.0.1:9222",
    );
    page = await browser.contexts()[0].newPage();
    const paced = pacedBrowser(page);
    let refreshed = 0;
    for (const listing of listings) {
      const url = new URL(listing.sourceUrl);
      if (
        url.protocol !== "https:" ||
        url.hostname !== "bstock.com" ||
        !/^\/buy\/listings\/details\/[a-z0-9]+$/i.test(url.pathname)
      )
        continue;
      await paced.goto(url.href);
      await page.locator("h1").first().waitFor({ timeout: 20000 });
      await page.waitForTimeout(4000);
      if (
        new URL(page.url()).hostname !== "bstock.com" ||
        /login|sign-in|captcha/.test(page.url())
      )
        throw new Error("reconnect");
      const text = await page.locator("body").innerText();
      if (
        /verify you are human|enter.{0,20}(verification|one.time)|sign in to your account|access denied/i.test(
          text,
        )
      )
        throw new Error("reconnect");
      const title = (
        await page.locator("h1").first().innerText({ timeout: 15000 })
      ).trim();
      if (!title) throw new Error("Listing title missing");
      const observation = listingObservation(text, title);
      await api("observation", { id: listing.id, ...observation });
      refreshed++;
    }
    await api("status", {
      id: "browser",
      status: "ok",
      message: `${refreshed} watched listings refreshed. Prices may change; costs require verification.`,
    });
  } catch (e) {
    await api("status", {
      id: "browser",
      status: e.message === "reconnect" ? "reconnect" : "error",
      message:
        "Browser refresh stopped. Reconnect B-Stock or check the browser worker; no login retries or bids were attempted.",
    }).catch(() => {});
    process.exitCode = 1;
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
if (process.argv[1]?.endsWith("browser-worker.mjs")) await main();
