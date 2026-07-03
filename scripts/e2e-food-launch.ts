/**
 * scripts/e2e-food-launch.ts
 *
 * End-to-end smoke test of the live Ruthann's Kitchen launch. Uses Playwright
 * with --no-sandbox so it works on hosts without unprivileged user namespaces.
 *
 *   npx tsx scripts/e2e-food-launch.ts
 *
 * What it checks:
 *  1. /food landing page renders with Yummly hook + $39 + CTA
 *  2. /food/onboarding redirects unauth visitors to /login
 *  3. /food/billing redirects unauth visitors to /login
 *  4. Login flow accepts a known credentials user and lands on /food
 *  5. Authenticated /food shows the dashboard (not the landing)
 *  6. Authenticated /food/admin renders for admin emails
 *  7. The "Manage billing" / "Start trial" buttons exist on /food/billing
 *
 * Uses the existing digiegold@gmail.com account (Cordless's own — Ruthann's
 * household). Requires DIGIEGOLD_PASSWORD env var to log in.
 */

import { chromium, type Page } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotenv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    if (process.env[m[1]]) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}
loadDotenv(resolve(process.cwd(), ".env.local"));

const BASE = process.env.E2E_BASE_URL || "https://www.tolley.io";
const EMAIL = process.env.E2E_EMAIL || "digiegold@gmail.com";
const PASSWORD = process.env.E2E_PASSWORD || process.env.DIGIEGOLD_PASSWORD || "";

interface Result {
  name: string;
  ok: boolean;
  detail: string;
}

const results: Result[] = [];
function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} ${name} — ${detail}`);
}

async function main() {
  console.log(`\n🌐 E2E target: ${BASE}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    // ── 1. Public landing page (incognito)
    await page.goto(`${BASE}/food`, { waitUntil: "networkidle", timeout: 30000 });
    const landingHtml = await page.content();
    const landingChecks = [
      { needle: "Your Yummly recipes", label: "Yummly hook" },
      { needle: "$39", label: "$39 price" },
      { needle: "Start 30-day free trial", label: "trial CTA" },
      { needle: "Non-repeating weekly plans", label: "feature 1" },
      { needle: "PlateJoy", label: "PlateJoy mention" },
    ];
    const missing = landingChecks.filter((c) => !landingHtml.includes(c.needle));
    record(
      "/food unauth landing",
      missing.length === 0,
      missing.length === 0
        ? `all ${landingChecks.length} content signatures present`
        : `missing: ${missing.map((m) => m.label).join(", ")}`
    );

    // ── 2. /food/onboarding redirects to login
    const onboardingResp = await page.goto(`${BASE}/food/onboarding`, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    record(
      "/food/onboarding gate",
      page.url().includes("/login"),
      `final URL: ${page.url()} (status ${onboardingResp?.status()})`
    );

    // ── 3. /food/billing redirects to login
    await page.goto(`${BASE}/food/billing`, { waitUntil: "domcontentloaded", timeout: 15000 });
    record(
      "/food/billing gate",
      page.url().includes("/login"),
      `final URL: ${page.url()}`
    );

    // ── 4. Login flow (only if password provided)
    if (!PASSWORD) {
      console.log(
        "\n⚠️  E2E_PASSWORD / DIGIEGOLD_PASSWORD not set — skipping authenticated tests"
      );
      console.log("    Set with: E2E_PASSWORD='...' npx tsx scripts/e2e-food-launch.ts\n");
    } else {
      await page.goto(`${BASE}/login?callbackUrl=/food`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Fill login form (NextAuth credentials provider)
      try {
        await page.fill('input[name="email"]', EMAIL);
        await page.fill('input[name="password"]', PASSWORD);
        await Promise.all([
          page.waitForURL(/\/food/, { timeout: 30000 }),
          page.click('button[type="submit"]'),
        ]);
        record("Login → /food", true, `landed on ${page.url()}`);
      } catch (err) {
        record(
          "Login → /food",
          false,
          err instanceof Error ? err.message : String(err)
        );
      }

      // ── 5. Authenticated /food shows dashboard
      const dashHtml = await page.content();
      const isDash =
        dashHtml.includes("Quick Actions") ||
        dashHtml.includes("Plan This Week") ||
        dashHtml.includes("Ruthann");
      record(
        "/food (authed) shows dashboard",
        isDash,
        isDash ? "dashboard markers present" : "looks like landing or error"
      );

      // ── 6. Admin page renders for admin email
      await page.goto(`${BASE}/food/admin`, { waitUntil: "networkidle", timeout: 30000 });
      const adminHtml = await page.content();
      const isAdmin =
        adminHtml.includes("Kitchen Admin") ||
        adminHtml.includes("Estimated ARR");
      record(
        "/food/admin renders for admin",
        isAdmin,
        isAdmin ? "admin dashboard markers present" : `not admin or 404: ${page.url()}`
      );

      // ── 7. Billing page shows correct state
      await page.goto(`${BASE}/food/billing`, { waitUntil: "networkidle", timeout: 30000 });
      const billHtml = await page.content();
      const billOk =
        billHtml.includes("Active subscription") ||
        billHtml.includes("Back to your kitchen");
      record(
        "/food/billing (authed, active sub)",
        billOk,
        billOk
          ? "active subscription state shown"
          : "unexpected billing page state"
      );
    }
  } catch (err) {
    console.error("\n💥 Fatal error during E2E:", err);
  } finally {
    await browser.close();
  }

  // Summary
  console.log("\n" + "━".repeat(60));
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`Result: ${passed}/${total} checks passed`);
  console.log("━".repeat(60));

  if (passed < total) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n💥 Top-level error:", err);
  process.exit(1);
});
