import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.OPENAI_TEST_BASE || "http://127.0.0.1:3076";
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const denied of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(({ denied }) => {
      Object.defineProperty(navigator, "globalPrivacyControl", { get: () => denied });
      Object.defineProperty(navigator, "doNotTrack", { get: () => "0" });
    }, { denied });
    const page = await context.newPage();
    await page.route("**/api/analytics", route => route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }));
    const submissions = [];
    let fail = true;
    // Always intercepted, including when checking production. No lead or message is created.
    await page.route("**/api/cleanouts/quote", async route => {
      submissions.push(route.request().postDataJSON());
      await route.fulfill({ status: fail ? 503 : 200, contentType: "application/json", body: JSON.stringify(fail ? { error: "Validation: save unavailable" } : { ok: true, leadId: "intercepted-browser-test" }) });
    });
    await page.goto(base + "/cleanouts?utm_source=chatgpt&utm_medium=cpc&oppref=browser-validation-ref", { waitUntil: "networkidle", timeout: 120000 });
    await page.locator("#tc-phone").fill("202-555-0100");
    await page.getByRole("button", { name: "Get My Free Quote", exact: true }).click();
    await page.getByText("Validation: save unavailable").waitFor();
    assert.equal(await page.getByText("Got it — quote coming your way", { exact: true }).count(), 0);
    assert.equal(submissions[0].openaiClickRef, denied ? undefined : "browser-validation-ref");
    // A reload without tracking parameters retains only the session click reference.
    await page.goto(base + "/cleanouts", { waitUntil: "networkidle" });
    await page.locator("#tc-phone").fill("202-555-0100");
    fail = false;
    await page.getByRole("button", { name: "Get My Free Quote", exact: true }).click();
    await page.getByText("Got it — quote coming your way", { exact: true }).waitFor();
    assert.equal(submissions[1].openaiClickRef, denied ? undefined : "browser-validation-ref");
    assert.equal(submissions[1].attribution.campaignSource, "chatgpt");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    results.push({ privacyOptOut: denied, retainedAdReference: !denied, failedSaveNoSuccess: true, successfulSaveReceipt: true, realSubmissions: 0 });
    await context.close();
  }
  const response = await fetch(base + "/api/openapi.json");
  assert.equal(response.status, 200);
  const spec = await response.json();
  const operation = spec.paths["/api/cleanouts/quote"].post;
  assert.equal(operation.operationId, "requestCleanoutQuote");
  assert.ok(operation.responses["200"].content["application/json"].schema.required.includes("leadId"));
  assert.equal(operation.requestBody.content["application/json"].schema.properties.smsConsent.default, false);
  console.log(JSON.stringify({ base, results, agentQuoteSchema: true }, null, 2));
} finally { await browser.close(); }
