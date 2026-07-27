/**
 * EstateSales.NET — authenticated browser session for the "Your Kc Homes"
 * company account.
 *
 * Modelled on scripts/pool360-sync.ts: a persistent Chromium profile holds the
 * session, so the password is supplied exactly once (via env at runtime) and
 * never written to disk. Later runs reuse the cookie jar.
 *
 *   ESN_PASSWORD='...' npx tsx scripts/esn-sync.ts --login    # first time
 *   npx tsx scripts/esn-sync.ts --map                         # dump account map
 *   npx tsx scripts/esn-sync.ts --shot <url>                  # screenshot a page
 *
 * Pacing is deliberate and human-scale (see PAUSE): one tab, no parallelism,
 * 3-6s between actions. This account is the business's best marketing channel
 * and their ToS makes termination automatic on breach — never make this fast,
 * never point it at other companies' pages, never use it to collect other
 * users' contact details.
 */

import fs from "node:fs";
import path from "node:path";
import { chromium, type Page, type BrowserContext } from "playwright";

const PROFILE_DIR = path.join(process.env.HOME || "/home/jelly", ".esn-profile");
const OUT_DIR = path.join(process.env.HOME || "/home/jelly", "business-os/esn-recon");
const EMAIL = process.env.ESN_EMAIL || "jared@yourkchomes.com";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const rand = (min: number, max: number) => Math.floor(min + Math.random() * (max - min));
/** Human-scale gap between actions. Do not shorten this. */
const PAUSE = (page: Page) => page.waitForTimeout(rand(3000, 6000));

async function isSignedIn(page: Page): Promise<boolean> {
  await page.goto("https://www.estatesales.net/account", { waitUntil: "domcontentloaded" });
  await PAUSE(page);
  return !/\/sign-in/.test(page.url());
}

async function login(page: Page) {
  const password = process.env.ESN_PASSWORD;
  if (!password) throw new Error("ESN_PASSWORD not set — pass it inline for this run only");

  console.log("[esn] signing in as", EMAIL);
  await page.goto("https://www.estatesales.net/sign-in", { waitUntil: "domcontentloaded" });
  await PAUSE(page);

  const email = page.locator('input[type="email"], input[name*="mail" i], #email').first();
  const pass = page.locator('input[type="password"], input[name*="ass" i], #password').first();
  await email.waitFor({ timeout: 30_000 });
  await email.fill(EMAIL);
  await PAUSE(page);
  await pass.fill(password);
  await PAUSE(page);

  await page
    .locator('button[type="submit"], input[type="submit"], button:has-text("Sign In")')
    .first()
    .click();
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
  await PAUSE(page);

  if (/\/sign-in/.test(page.url())) {
    throw new Error(`still on sign-in after submit — check for a captcha/2FA. url=${page.url()}`);
  }
  console.log("[esn] signed in. session saved to", PROFILE_DIR);
}

/** Record a page: screenshot + visible text + the links/forms on it. */
async function capture(page: Page, url: string, slug: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await PAUSE(page);
  await page.screenshot({ path: path.join(OUT_DIR, `${slug}.png`), fullPage: true });

  const info = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    text: (document.body.innerText || "").slice(0, 6000),
    links: Array.from(document.querySelectorAll("a[href]"))
      .map((a) => ({ text: (a.textContent || "").trim().slice(0, 60), href: (a as HTMLAnchorElement).href }))
      .filter((l) => l.text)
      .slice(0, 120),
    inputs: Array.from(document.querySelectorAll("input,textarea,select")).map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: (el as HTMLInputElement).type || "",
      name: (el as HTMLInputElement).name || "",
      id: el.id || "",
    })),
  }));

  fs.writeFileSync(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(info, null, 2));
  console.log(`[esn] captured ${slug}: ${info.title} (${info.links.length} links, ${info.inputs.length} inputs)`);
  return info;
}

async function main() {
  const args = process.argv.slice(2);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const ctx: BrowserContext = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    userAgent: UA,
    viewport: { width: 1920, height: 1080 },
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  try {
    if (!(await isSignedIn(page))) {
      if (!args.includes("--login") && !process.env.ESN_PASSWORD) {
        throw new Error("not signed in — rerun with ESN_PASSWORD=... --login");
      }
      await login(page);
    } else {
      console.log("[esn] existing session is still good");
    }

    const shotIdx = args.indexOf("--shot");
    if (shotIdx !== -1 && args[shotIdx + 1]) {
      await capture(page, args[shotIdx + 1], "adhoc");
      return;
    }

    // Account map: the pages we actually operate out of.
    const targets: Array<[string, string]> = [
      ["https://www.estatesales.net/account", "account-home"],
      ["https://www.estatesales.net/account/company", "company-profile"],
      ["https://www.estatesales.net/account/sales", "my-sales"],
      ["https://www.estatesales.net/account/leads", "client-leads"],
      ["https://www.estatesales.net/account/marketplace", "marketplace"],
    ];
    for (const [url, slug] of targets) {
      try {
        await capture(page, url, slug);
      } catch (e) {
        console.log(`[esn] ${slug} failed: ${(e as Error).message}`);
      }
    }
  } finally {
    await ctx.close();
  }
}

main().catch((err) => {
  console.error("[esn] failed:", err.message);
  process.exit(1);
});
