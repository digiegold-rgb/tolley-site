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

/**
 * Interactive sign-in. ESN runs reCAPTCHA v3, which scores a scripted headless
 * login as a bot and then returns a *fake* "Email Address and/or Password was
 * incorrect" error rather than saying so (verified 2026-07-27: the same
 * password signed in fine by hand seconds later). So we don't script the
 * credential entry at all — we open a real window, the human signs in, and we
 * keep the cookie jar. Same approach as scripts/pool360-sync.ts.
 */
async function login(page: Page) {
  console.log("\n  A browser window is opening on this machine's desktop.");
  console.log("  Sign in there as", EMAIL, "— by hand, like normal.");
  console.log("  Leave the window alone once you're in; this will detect it.\n");

  await page.goto("https://www.estatesales.net/sign-in", { waitUntil: "domcontentloaded" });

  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);
    if (!/\/sign-in/.test(page.url())) break;
    const left = Math.ceil((deadline - Date.now()) / 1000);
    if (left % 30 === 0) console.log(`  …still waiting (${left}s left)`);
  }

  if (/\/sign-in/.test(page.url())) {
    // Dump what the page is actually showing rather than guessing — a wrong
    // password, a captcha, and a device check all look identical from here.
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const shot = path.join(OUT_DIR, "signin-failure.png");
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    const diag = await page.evaluate(() => {
      const txt = (document.body.innerText || "").replace(/\n{2,}/g, "\n").slice(0, 2500);
      const errs = Array.from(
        document.querySelectorAll('[class*="error" i],[class*="alert" i],[role="alert"],.validation-summary-errors')
      )
        .map((e) => (e.textContent || "").trim())
        .filter(Boolean);
      const captcha = /recaptcha|hcaptcha|cf-turnstile/i.test(document.documentElement.innerHTML);
      return { errs, captcha, txt };
    });
    console.log("\n===== SIGN-IN DIAGNOSTIC =====");
    console.log("captcha present on page:", diag.captcha);
    console.log("error elements:", diag.errs.length ? diag.errs : "(none found)");
    console.log("--- visible page text ---\n" + diag.txt);
    console.log("screenshot:", shot);
    console.log("==============================\n");
    throw new Error(`timed out waiting for sign-in. url=${page.url()}`);
  }
  console.log("[esn] sign-in detected.");
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

  // --login opens a real window (reCAPTCHA v3 scores headless as a bot);
  // every later run is headless off the saved session.
  const interactive = args.includes("--login");
  const ctx: BrowserContext = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !interactive,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    userAgent: UA,
    viewport: { width: 1920, height: 1080 },
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  try {
    if (!(await isSignedIn(page))) {
      if (!interactive) {
        throw new Error("not signed in — rerun with --login (opens a window to sign in by hand)");
      }
      await login(page);
      if (!(await isSignedIn(page))) throw new Error("sign-in didn't complete");
      console.log("[esn] signed in. session saved to", PROFILE_DIR);
    } else {
      console.log("[esn] existing session is still good");
    }

    const shotIdx = args.indexOf("--shot");
    if (shotIdx !== -1 && args[shotIdx + 1]) {
      await capture(page, args[shotIdx + 1], "adhoc");
      return;
    }

    // DISCOVER the account, don't assume it. Land on /account, read the real
    // navigation off the page, then follow those links. Guessing deep URLs
    // (/account/leads, /account/marketplace, ...) was wrong: they 404, and
    // hammering invented paths is exactly what bot detection looks for.
    const home = await capture(page, "https://www.estatesales.net/account", "account-home");

    const nav = home.links
      .filter((l) => /estatesales\.net\/(account|company|my)/i.test(l.href))
      .filter((l, i, a) => a.findIndex((x) => x.href === l.href) === i)
      .filter((l) => l.href !== home.url);

    console.log(`\n[esn] ${nav.length} real account links found on /account:`);
    for (const l of nav) console.log(`   ${l.text}  →  ${l.href}`);

    if (!nav.length) {
      console.log("[esn] none found — check account-home.png/.json to see the real page.");
      return;
    }

    // Follow only what the page actually offered.
    for (const l of nav) {
      const slug = l.href.split("/").filter(Boolean).slice(2).join("-").slice(0, 60) || "page";
      try {
        await capture(page, l.href, slug);
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
