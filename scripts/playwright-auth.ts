/**
 * Playwright auth helper for E2E walkthroughs of `/content`.
 *
 * Logs in as a dedicated audit user via the NextAuth credentials flow, then
 * writes the resulting cookies to a Playwright `storage_state.json` file
 * that any later test or audit can load with `browser.newContext({ storageState })`.
 *
 * Usage:
 *   PLAYWRIGHT_AUTH_EMAIL=audit@tolley.io \
 *   PLAYWRIGHT_AUTH_PASSWORD=... \
 *   npx tsx scripts/playwright-auth.ts
 *
 * Outputs:
 *   tolley-site/.playwright-state.json   (gitignored — contains a session cookie)
 *
 * Setup (one-time):
 *   1. In the database, create a User row with role=admin (or equivalent for /content access)
 *      and a verified email. Use `npx tsx scripts/create-vater-admin-user.ts` as a template.
 *   2. Drop the credentials into a local `.env.audit` file or pass them via env vars.
 *   3. Run this script. It writes `.playwright-state.json` next to the project root.
 *   4. Future Playwright runs can do:
 *        const ctx = await browser.newContext({ storageState: '.playwright-state.json' });
 *
 * Why we built this:
 *   The earlier audit hit a NextAuth signin redirect when navigating to
 *   `https://www.tolley.io/content` and could not test interactive elements.
 *   This helper produces a reusable session so the next Playwright agent
 *   can walk every section without auth blocking.
 */

import { chromium, type Cookie } from "playwright";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SITE = process.env.PLAYWRIGHT_AUTH_BASE_URL || "https://www.tolley.io";
const EMAIL = process.env.PLAYWRIGHT_AUTH_EMAIL;
const PASSWORD = process.env.PLAYWRIGHT_AUTH_PASSWORD;
const OUT_PATH = resolve(process.cwd(), ".playwright-state.json");

if (!EMAIL || !PASSWORD) {
  console.error("Set PLAYWRIGHT_AUTH_EMAIL and PLAYWRIGHT_AUTH_PASSWORD before running.");
  console.error("Example: PLAYWRIGHT_AUTH_EMAIL=audit@tolley.io PLAYWRIGHT_AUTH_PASSWORD=... npx tsx scripts/playwright-auth.ts");
  process.exit(1);
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL: SITE });
  const page = await ctx.newPage();

  const target = "/login?callbackUrl=%2Fcontent";
  console.log(`navigating ${SITE}${target}`);
  await page.goto(target, { waitUntil: "networkidle" });

  // The login form on /login has email + password inputs and a submit button.
  // Use a few selector strategies to be robust across small layout changes.
  const emailField = page.locator('input[type="email"], input[name="email"]').first();
  const passwordField = page.locator('input[type="password"], input[name="password"]').first();
  await emailField.waitFor({ state: "visible", timeout: 15000 });
  await emailField.fill(EMAIL!);
  await passwordField.fill(PASSWORD!);

  const submit = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Sign in")').first();
  await Promise.all([
    page.waitForURL((url) => !/\/login(\?|$)/.test(url.pathname + url.search), { timeout: 30000 }).catch(() => {}),
    submit.click(),
  ]);

  // Confirm we landed on a non-login URL, ideally /content
  const current = page.url();
  console.log(`post-login URL: ${current}`);
  if (current.includes("/login")) {
    console.error("Still on /login after submit — credentials likely rejected, or MFA is required.");
    await browser.close();
    process.exit(2);
  }

  // Pull cookies + write storage state
  const state = await ctx.storageState();
  const cookies: Cookie[] = state.cookies;
  const sessionCookie = cookies.find((c) => /next-auth\.session-token|__Secure-next-auth\.session-token|authjs\.session-token/i.test(c.name));
  if (!sessionCookie) {
    console.error("No NextAuth session cookie found — auth may have used a different mechanism.");
    console.error("Cookies present:", cookies.map((c) => c.name).join(", "));
    await browser.close();
    process.exit(3);
  }

  writeFileSync(OUT_PATH, JSON.stringify(state, null, 2));
  console.log(`storage state written to ${OUT_PATH}`);
  console.log(`session cookie: ${sessionCookie.name} (expires ${new Date(sessionCookie.expires * 1000).toISOString()})`);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(99);
});
