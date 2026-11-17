import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.LAUNDRY_TEST_URL || "http://127.0.0.1:3065";
if (!base.startsWith("http://127.0.0.1:3065"))
  throw new Error("Local laundry test app required");
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/laundry", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Your laundry/ }).waitFor();
  await page.screenshot({ path: "/tmp/laundry-desktop.png", fullPage: true });
  await page.getByLabel("City and state or ZIP code").fill("66212");
  await page.getByRole("button", { name: "Find my rental" }).click();
  await page.getByRole("heading", { name: "Rentals near 66212" }).waitFor();
  await page.getByRole("link", { name: "View details" }).first().click();
  await page
    .getByRole("heading", { name: "Wash & Dry Rental", exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Request a rental" }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Browser Test");
  await page.getByLabel("Phone", { exact: true }).fill("9135550198");
  await page
    .getByLabel("Email", { exact: true })
    .fill("browser@example.invalid");
  await page.getByLabel("Delivery ZIP", { exact: true }).fill("66212");
  await page
    .getByLabel("Street address")
    .fill("123 Test Street " + crypto.randomUUID() + ", Overland Park");
  await page
    .getByLabel("Preferred delivery day")
    .fill(new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10));
  await page.getByLabel("Type your full name to sign").fill("Browser Test");
  await page.getByRole("checkbox", { name: /I agree to the/ }).check();
  await page.getByRole("button", { name: "Sign & request delivery" }).click();
  await page.waitForURL(/\/laundry\/request\/.+\?token=/);
  await page.getByRole("heading", { name: "Your request is saved." }).waitFor();
  assert.ok(
    await page
      .getByRole("link", { name: "Download signed agreement" })
      .isVisible(),
  );
  const receipt = page.url();
  const download = await page.request.get(
    new URL(
      await page
        .getByRole("link", { name: "Download signed agreement" })
        .getAttribute("href"),
      base,
    ).href,
  );
  assert.equal(download.status(), 200);
  assert.match(await download.text(), /Signed by: Browser Test/);
  assert.equal(
    await page
      .locator('script[src*="googletagmanager"],script[src*="facebook.net"]')
      .count(),
    0,
  );
  await page.goto(receipt.replace(/token=.*/, "token=invalid"));
  assert.equal(await page.getByRole("heading", { name: /404/ }).count(), 1);
  const api = await page.request.get(base + "/api/laundry/dashboard");
  assert.equal(api.status(), 401);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/laundry", { waitUntil: "networkidle" });
  await page.screenshot({ path: "/tmp/laundry-mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.getByLabel("City and state or ZIP code").fill("99501");
  await page.getByRole("button", { name: "Find my rental" }).click();
  await page
    .getByRole("heading", { name: /growing into your neighborhood/ })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS desktop/mobile rendering, ZIP search, profile, signed request, private receipt/download, invalid token denial, anonymous dashboard denial and uncovered ZIP.",
  );
} finally {
  await browser.close();
}
