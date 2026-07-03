/**
 * Pool360 Automated Re-Authentication
 *
 * Logs into Pool360 via Azure B2C using stored credentials,
 * saves the session to the persistent browser profile so
 * the daily headless sync can access prices.
 */

import { chromium, type Page } from "playwright";
import path from "path";

const POOL360_BASE = "https://www.pool360.com";
const BROWSER_PROFILE_DIR = path.join(
  process.env.HOME || "/home/jelly",
  ".pool360-profile"
);

const EMAIL = "ruthann@kcmopools.com";
const PASSWORD = "Flare564";

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() =>
      fetch("/api/v1/sessions/current")
        .then((r) => r.json())
        .then((j) => !!(j.isAuthenticated === true || j.warehouse?.id))
        .catch(() => false)
    );
  } catch {
    return false;
  }
}

async function debugPage(page: Page, label: string) {
  console.log(`[debug:${label}] URL: ${page.url()}`);
  console.log(`[debug:${label}] Title: ${await page.title()}`);
  // Get clickable elements text
  const links = await page.evaluate(() => {
    const els: string[] = [];
    document.querySelectorAll("a, button").forEach((el) => {
      const text = (el as HTMLElement).innerText?.trim();
      const href = (el as HTMLAnchorElement).href || "";
      if (text && text.length < 60) {
        els.push(`${el.tagName}[${text}]${href ? " → " + href : ""}`);
      }
    });
    return els.slice(0, 40);
  });
  console.log(`[debug:${label}] Clickable:`, links.join(" | "));
}

async function main() {
  console.log(`[reauth] Pool360 Re-Auth — ${new Date().toISOString()}`);

  const context = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  });
  const page = context.pages()[0] || (await context.newPage());

  try {
    console.log("[reauth] Loading pool360.com...");
    await page.goto(POOL360_BASE, { waitUntil: "domcontentloaded" });
    await delay(4000);

    if (await isAuthenticated(page)) {
      console.log("[reauth] Already authenticated! No action needed.");
      return;
    }

    console.log("[reauth] Not authenticated. Finding sign-in...");
    await debugPage(page, "home");

    // Try clicking "My Account" or "Sign In" text in the top bar
    const myAcct = page.locator('text="My Account"').first();
    if (await myAcct.isVisible({ timeout: 3000 }).catch(() => false)) {
      await myAcct.click();
      console.log("[reauth] Clicked 'My Account'");
      await delay(2000);
      await debugPage(page, "after-myaccount");
    }

    // Look for Sign In / Login link
    const signInOptions = [
      page.locator('a:has-text("Sign In")').first(),
      page.locator('button:has-text("Sign In")').first(),
      page.locator('a:has-text("Log In")').first(),
      page.locator('text="Sign In / Register"').first(),
      page.locator('a[href*="signin"]').first(),
      page.locator('a[href*="login"]').first(),
      page.locator('a[href*="SignIn"]').first(),
      page.locator('a[href*="auth"]').first(),
    ];

    let signInClicked = false;
    for (const loc of signInOptions) {
      try {
        if (await loc.isVisible({ timeout: 1500 })) {
          await loc.click();
          signInClicked = true;
          console.log("[reauth] Clicked sign-in link");
          break;
        }
      } catch {
        continue;
      }
    }

    if (!signInClicked) {
      // Try direct B2C URL — Pool360 uses Azure B2C
      console.log("[reauth] No sign-in link found. Trying direct auth URL...");
      // Navigate to a protected page to trigger redirect
      await page.goto(`${POOL360_BASE}/MyAccount`, { waitUntil: "domcontentloaded" });
      await delay(4000);
      console.log("[reauth] Redirected to:", page.url());
    }

    await delay(3000);
    console.log("[reauth] Current URL after sign-in click:", page.url());
    await debugPage(page, "login-page");

    // Now we should be on the B2C login page
    // Try to find and fill email
    const emailSelectors = [
      'input[type="email"]',
      'input[name="loginfmt"]',
      'input[name="login"]',
      'input[id="signInName"]',
      'input[id="email"]',
      '#signInName',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]',
      'input[name="signInName"]',
    ];

    let emailFilled = false;
    for (const sel of emailSelectors) {
      try {
        const input = page.locator(sel).first();
        if (await input.isVisible({ timeout: 2000 })) {
          await input.fill(EMAIL);
          emailFilled = true;
          console.log(`[reauth] Filled email via: ${sel}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!emailFilled) {
      await page.screenshot({ path: "/home/jelly/tolley-site/logs/reauth-debug.png" });
      console.error("[reauth] Could not find email field. Screenshot saved.");
      process.exit(1);
    }

    await delay(1000);

    // Handle "Next" button if present (some B2C flows split email/password)
    const nextBtn = page.locator('button:has-text("Next"), input[type="submit"][value="Next"]').first();
    if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nextBtn.click();
      console.log("[reauth] Clicked Next");
      await delay(2000);
    }

    // Fill password
    const pwSelectors = [
      'input[type="password"]',
      'input[name="passwd"]',
      'input[name="password"]',
      'input[id="password"]',
      '#password',
    ];

    let pwFilled = false;
    for (const sel of pwSelectors) {
      try {
        const input = page.locator(sel).first();
        if (await input.isVisible({ timeout: 3000 })) {
          await input.fill(PASSWORD);
          pwFilled = true;
          console.log(`[reauth] Filled password via: ${sel}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!pwFilled) {
      await page.screenshot({ path: "/home/jelly/tolley-site/logs/reauth-debug.png" });
      console.error("[reauth] Could not find password field. Screenshot saved.");
      process.exit(1);
    }

    await delay(500);

    // Submit
    const submitSelectors = [
      'button[type="submit"]',
      '#next',
      'input[type="submit"]',
      'button:has-text("Sign in")',
      'button:has-text("Log in")',
    ];

    for (const sel of submitSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 })) {
          await btn.click();
          console.log(`[reauth] Submitted via: ${sel}`);
          break;
        }
      } catch {
        continue;
      }
    }

    console.log("[reauth] Waiting for auth redirect...");
    await delay(8000);
    console.log("[reauth] Post-login URL:", page.url());

    // Handle "Stay signed in?"
    const stayYes = page.locator('button:has-text("Yes"), input[type="submit"][value="Yes"]').first();
    if (await stayYes.isVisible({ timeout: 3000 }).catch(() => false)) {
      await stayYes.click();
      console.log("[reauth] Clicked 'Stay signed in = Yes'");
      await delay(3000);
    }

    // Handle ChangeAccount page
    if (page.url().includes("ChangeAccount")) {
      console.log("[reauth] Account selection page...");
      const continueBtn = page.locator('button:has-text("Continue")');
      try {
        await continueBtn.waitFor({ timeout: 5000 });
        await continueBtn.click();
        await delay(3000);
      } catch { /* ok */ }
    }

    // Dismiss delivery modal
    try {
      const dontShowBtn = page.locator('text="Don\'t show anymore"');
      await dontShowBtn.waitFor({ timeout: 5000 });
      await dontShowBtn.click();
      await delay(1000);
    } catch { /* ok */ }

    // Final check
    await page.goto(POOL360_BASE, { waitUntil: "domcontentloaded" });
    await delay(3000);

    if (await isAuthenticated(page)) {
      console.log("[reauth] SUCCESS — fully authenticated! Session saved.");
    } else {
      await page.screenshot({ path: "/home/jelly/tolley-site/logs/reauth-debug.png" });
      console.error("[reauth] FAILED — not authenticated after login.");
      console.error("[reauth] Final URL:", page.url());
      process.exit(1);
    }
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error("[reauth] Fatal:", err);
  process.exit(1);
});
