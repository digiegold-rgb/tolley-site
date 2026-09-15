/* eslint-disable @typescript-eslint/no-explicit-any -- mocked JSON request/response fixtures */
/** Browser workflow regression. API calls are fulfilled locally; never starts paid jobs. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, expect as baseExpect, type Page } from "@playwright/test";
import { defaultJobCard } from "../lib/generate-job-card";
import { emptyLongformQueue, planLongformQueue, estimateLongform } from "../lib/generate-longform";
import { emptyCinemaQueue, planCinemaQueue, estimateCinema } from "../lib/generate-cinema";

const expect = baseExpect.configure({ timeout: 15_000 });

async function main() {
const base = process.env.GENERATE_TEST_URL || "http://127.0.0.1:3024";
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const out = "/tmp/tolley-generate-guided-review";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64");
const browser = await chromium.launch({ headless: true });
const errors: string[] = [];
const posts: { path: string; body: any }[] = [];
let authed = true, unlocked = false, failNext = false;
let longform = emptyLongformQueue();
let cinema = emptyCinemaQueue();
let jobs: any[] = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
context.setDefaultTimeout(30_000);
context.setDefaultNavigationTimeout(60_000);
await context.route("**/api/**", async route => {
  const path = new URL(route.request().url()).pathname;
  const method = route.request().method();
  if (!path.startsWith("/api/generate/") && path !== "/api/gen2/access") return route.fulfill({ json: {} });
  const body = method === "POST" && path !== "/api/generate/upload" ? route.request().postDataJSON() : {};
  if (method === "POST") posts.push({ path, body });
  if (path.endsWith("/image")) return route.fulfill({ contentType: "image/png", body: png });
  if (path === "/api/gen2/access") return route.fulfill({ status: authed ? 200 : 401, json: authed ? { authenticated: true, modal: { configured: true }, fal: { configured: true } } : { code: "LOGIN_REQUIRED", error: "Sign in with your owner account to use Generate.", loginUrl: "/login?callbackUrl=%2Fgen2" } });
  if (path === "/api/generate/chat") return route.fulfill({ json: { configured: true } });
  if (path === "/api/generate/library") { unlocked = method === "POST"; return route.fulfill({ json: { unlocked } }); }
  if (path === "/api/generate/upload") return route.fulfill({ json: { url: "https://example.com/upload.png" } });
  if (path === "/api/generate/jobs" && method === "GET") return route.fulfill({ status: authed ? 200 : 401, json: authed ? {
    jobs: unlocked ? jobs : [], library: { unlocked }, modal: { configured: true }, fal: { configured: true },
    defaults: defaultJobCard(null, { GENERATE_IDENTITY_REF_URLS: "https://example.com/front.png" }),
    longform_queue: longform, cinema_queue: cinema,
  } : { error: "Unauthorized" } });
  if (path === "/api/generate/jobs" && method === "POST") {
    if (failNext) { failNext = false; return route.fulfill({ status: 503, json: { error: "Test provider temporarily unavailable" } }); }
    if (body.dryRun) return route.fulfill({ json: { dryRun: true } });
    const job = { id: "guided-test", recipe: body.kind === "t2i" ? "fal-flux-t2i" : "fal-wan-i2v", status: "done", output_urls: ["https://example.com/result.png"] };
    jobs = [job];
    return route.fulfill({ json: { job } });
  }
  if (path === "/api/generate/jobs/guided-test") return route.fulfill({ json: { job: jobs[0] } });
  if (path === "/api/generate/longform") {
    if (body.action === "plan") longform = planLongformQueue(body);
    else if (body.action === "save" && body.queue) longform = body.queue;
    return route.fulfill({ json: { queue: longform, job: { id: "longform-test" }, estimate: estimateLongform({ targetSeconds: longform.target_seconds, beatSeconds: longform.beat_seconds }) } });
  }
  if (path === "/api/generate/cinema") {
    if (body.action === "plan") cinema = planCinemaQueue(body);
    else if (body.action === "save" && body.queue) cinema = body.queue;
    return route.fulfill({ json: { queue: cinema, job: { id: "cinema-test" }, estimate: estimateCinema(cinema) } });
  }
  if (path === "/api/generate/beats") return route.fulfill({ json: { queue: body.queue, job: { id: "beats-test" } } });
  return route.fulfill({ json: {} });
});
await context.route("https://example.com/**", route => route.fulfill({ contentType: "image/png", body: png }));
const page = await context.newPage();
page.on("pageerror", err => errors.push(err.message));
async function visit(url: string) {
  const loaded = page.waitForResponse(r => new URL(r.url()).pathname === "/api/generate/jobs" && r.request().method() === "GET");
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await loaded; // The client effect has mounted; controls now have React handlers.
}
async function step(n: number) { await page.getByRole("navigation", { name: "Creation steps" }).getByRole("button").nth(n).click(); }
async function choose(name: string) { await step(0); await page.getByRole("button", { name: new RegExp(`^${name}`) }).click(); await page.getByRole("button", { name: "Start this workflow" }).click(); }
async function noOverflow(p: Page) { assert(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Horizontal overflow"); }
try {
  await mkdir(out, { recursive: true });
  const loadingContext = await browser.newContext({ javaScriptEnabled: false });
  try {
    const loadingPage = await loadingContext.newPage();
    await loadingPage.goto(`${base}/gen2`, { waitUntil: "domcontentloaded" });
    await expect(loadingPage.getByRole("button", { name: "Start this workflow" })).toBeDisabled();
    await expect(loadingPage.getByRole("button", { name: /^Create an image/ })).toBeDisabled();
    await expect(loadingPage.getByRole("button", { name: "All controls", exact: true })).toBeDisabled();
  } finally { await loadingContext.close(); }
  await visit(`${base}/generate`);
  await expect(page.locator(".gen-root")).toBeVisible();
  await expect(page.locator(".gen2-root")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Creation steps" })).toHaveCount(0);
  await visit(`${base}/gen2`);
  await expect(page.locator(".gen2-root")).toBeVisible();
  await expect(page.getByRole("link", { name: "Original Generate", exact: true })).toHaveAttribute("href", "/generate");
  await expect(page.getByRole("heading", { name: "Choose a workflow", exact: true })).toBeVisible();
  await expect(page.getByLabel("Your prompt", { exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Open library", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "All controls", exact: true }).click();
  await expect(page.getByRole("button", { name: "Guided view", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Guided view", exact: true }).click();
  await noOverflow(page);
  await page.screenshot({ path: `${out}/01-workflows-desktop.png`, fullPage: true });
  await page.getByRole("button", { name: "Start this workflow" }).click();
  await expect(page.getByRole("button", { name: "Continue to settings" })).toBeDisabled();
  await page.getByLabel("Your prompt", { exact: true }).fill("A ceramic vase on a sunlit oak table");
  await page.getByLabel("Scene details", { exact: true }).fill("Soft morning light, no text");
  await page.getByRole("button", { name: "Continue to settings" }).click();
  await page.getByLabel("Output aspect ratio").selectOption("16:9");
  await page.getByLabel("Generation model", { exact: true }).selectOption("flux-schnell");
  await expect(page.getByTestId("model-cost")).toContainText("$0.006");
  await step(1);
  await expect(page.getByLabel("Your prompt", { exact: true })).toHaveValue("A ceramic vase on a sunlit oak table");
  await page.screenshot({ path: `${out}/02-brief-desktop.png`, fullPage: true });
  await step(3);
  await page.getByRole("checkbox", { name: "Dry run" }).check();
  await page.getByRole("button", { name: "Dry run", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Test complete" })).toBeVisible();
  const test = posts.find(p => p.path === "/api/generate/jobs")!.body;
  assert.equal(test.start, false); assert.equal(test.dryRun, true); assert.equal(test.aspect, "16:9");
  assert.equal(test.card.model, "flux-schnell");
  await expect(page.getByTestId("model-cost")).toContainText("$0 generation spend");
  assert.match(test.prompt, /ceramic vase/); assert.match(test.prompt, /morning light/);
  await page.getByRole("checkbox", { name: "Dry run" }).uncheck();
  failNext = true;
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.locator(".gen-err[role=alert]")).toHaveText("Test provider temporarily unavailable");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.getByRole("button", { name: "Unlock the library to preview it" })).toBeVisible();
  await expect(page.locator(".gen-result")).toHaveCount(0);
  await page.getByRole("button", { name: "Unlock the library to preview it" }).click();
  await page.getByLabel("Library passcode").fill("1234");
  await page.getByRole("button", { name: "Unlock library", exact: true }).click();
  await expect(page.locator(".gen-result img")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use as source", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Use as source", exact: true }).click();
  await expect(page.getByLabel("Starting image URL")).toHaveValue("/api/generate/jobs/guided-test/image?i=0");
  await expect(page.getByRole("heading", { name: "Describe & add sources", exact: true })).toBeVisible();
  await page.getByLabel("Upload image to animate").setInputFiles({ name: "source.png", mimeType: "image/png", buffer: png });
  await step(2); await step(1);
  assert.equal(await page.getByLabel("Upload image to animate").evaluate((el: HTMLInputElement) => el.files?.[0]?.name), "source.png");
  await page.getByLabel("Generation model", { exact: true }).selectOption("wan30-i2v");
  assert.equal(await page.getByLabel("Upload image to animate").evaluate((el: HTMLInputElement) => el.files?.[0]?.name), "source.png");
  await page.getByLabel("Starting image URL").fill("https://example.com/replacement.png");
  assert.equal(await page.getByLabel("Upload image to animate").evaluate((el: HTMLInputElement) => el.files?.length), 0);
  await step(3);
  await page.getByRole("checkbox", { name: "Dry run" }).check();
  await page.getByRole("button", { name: "Dry run", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Test complete" })).toBeVisible();
  const imageVideo = posts.filter(p => p.path === "/api/generate/jobs").at(-1)!.body;
  assert.equal(imageVideo.card.model, "wan30-i2v");
  assert.equal(imageVideo.card.source_image_url, "https://example.com/replacement.png");
  await page.getByRole("checkbox", { name: "Dry run" }).uncheck();
  await choose("Create a character still");
  await expect(page.getByLabel("Generation model", { exact: true })).toBeEnabled();
  await expect(page.getByTestId("model-cost")).toContainText("$0.25");
  await page.getByLabel("Assumed compute minutes per image").fill("10");
  await expect(page.getByTestId("model-cost")).toContainText("$0.50");
  await page.getByLabel("Generation model", { exact: true }).selectOption("flux2-edit");
  await expect(page.getByTestId("model-cost")).toContainText("FLUX.2 supports up to 4");
  await step(3);
  await page.getByRole("checkbox", { name: "Dry run" }).check();
  await page.getByRole("button", { name: "Dry run", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Test complete" })).toBeVisible();
  assert.equal(posts.filter(p => p.path === "/api/generate/jobs").at(-1)!.body.card.model, "flux2-edit");
  await page.getByRole("checkbox", { name: "Dry run" }).uncheck();
  await step(1);
  await page.getByLabel("Generation model", { exact: true }).selectOption("qwen-edit");
  await step(2); await step(1);
  await expect(page.getByLabel("Generation model", { exact: true })).toHaveValue("qwen-edit");
  await expect(page.getByLabel("Identity reference 1", { exact: true })).toBeVisible();
  const location = page.getByLabel("Location preset", { exact: true });
  assert(await location.locator("option").count() > 400);
  await page.getByLabel("Search location options").fill("rooftop");
  assert(await location.locator("option").count() > 1);
  await location.selectOption({ index: 1 });
  await page.getByLabel("Search location options").fill("");
  const locationValue = await location.inputValue();
  await page.getByLabel("Hair preset", { exact: true }).selectOption({ index: 8 });
  await page.getByLabel("Camera preset", { exact: true }).selectOption({ index: 8 });
  await step(2); await step(1);
  await expect(location).toHaveValue(locationValue);
  await page.screenshot({ path: `${out}/character-dropdowns-desktop.png`, fullPage: true });
  await expect(page.getByRole("button", { name: "Random seed", exact: true })).toBeHidden();
  await step(2);
  await page.getByRole("group", { name: "NSFW wardrobe and negative" }).getByRole("button", { name: "Allow NSFW" }).click();
  await page.getByText("Advanced JSON", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Apply JSON", exact: true })).toBeVisible();
  await page.screenshot({ path: `${out}/03-character-settings.png`, fullPage: true });
  await choose("Direct a sequence");
  await page.getByTestId("beat-1-prompt").fill("Camera moves gently around the vase");
  await page.getByLabel("Generation model", { exact: true }).selectOption("wan30-i2v");
  await step(2); await step(1);
  await expect(page.getByTestId("beat-1-prompt")).toHaveValue("Camera moves gently around the vase");
  await page.locator('input[placeholder="Use as source on a Modal still, or paste https://…"]').fill("https://example.com/motion.png");
  await step(3);
  await page.getByRole("checkbox", { name: "Dry run" }).check();
  await page.getByLabel("Beat 1 model", { exact: true }).selectOption("wan-legacy");
  await expect(page.getByLabel("Generation model", { exact: true })).toHaveValue("wan-legacy");
  await page.getByLabel("Beat 1 model", { exact: true }).selectOption("wan30-i2v");
  await page.locator(".gen-beat-actions").first().getByRole("button", { name: "Generate this beat", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Test complete" })).toBeVisible();
  assert.equal(posts.filter(p => p.path === "/api/generate/jobs").at(-1)!.body.card.model, "wan30-i2v");
  assert(!posts.some(p => p.path === "/api/generate/beats" && p.body.action === "generate"), "Dry-run beat must not submit a paid request");
  await page.getByRole("checkbox", { name: "Dry run" }).uncheck();
  await choose("Build a continuous video");
  await page.locator('input[placeholder="Use as source on a Modal still, or paste https://…"]').fill("https://example.com/source.png");
  await page.getByTestId("motion2-script").fill("Camera moves forward\nCamera moves left");
  await page.getByRole("button", { name: "Continue to settings" }).click();
  await expect(page.getByRole("button", { name: "Review & generate" })).toBeDisabled();
  await page.getByRole("button", { name: /^Plan \d+ beats$/ }).click();
  await expect(page.getByRole("button", { name: "Review & generate" })).toBeEnabled();
  await page.getByRole("button", { name: "Review & generate" }).click();
  await expect(page.getByTestId("motion2-go")).toBeEnabled();
  await expect(page.getByRole("list", { name: "Longform beat review" })).toBeVisible();
  assert(!posts.some(p => p.path.includes("longform") && /generate|run/.test(p.body.action)), "Planning must not render");
  await choose("Make a cinematic film");
  await page.getByTestId("cinema-image-urls").fill("https://example.com/reference.png");
  await page.getByTestId("cinema-script").fill("Welcome to the garden.\nWatch the sun come up.");
  await step(2);
  await page.getByRole("button", { name: "Plan beats", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review & generate" })).toBeEnabled();
  await step(3);
  await expect(page.getByTestId("cinema-go")).toBeEnabled();
  await page.getByLabel("Generation model", { exact: true }).selectOption("kling");
  await expect(page.getByTestId("model-cost")).toContainText("$1.68");
  await step(1);
  await expect(page.getByTestId("cinema-script")).toHaveValue("Welcome to the garden.\nWatch the sun come up.");
  await expect(page.getByTestId("cinema-image-urls")).toHaveValue("https://example.com/reference.png");
  await step(3);
  await expect(page.getByRole("list", { name: "Cinema beat review" })).toBeVisible();
  await page.screenshot({ path: `${out}/04-cinema-review.png`, fullPage: true });
  await page.getByRole("button", { name: "All controls", exact: true }).click();
  await expect(page.getByTestId("cinema-image-urls")).toBeVisible();
  await expect(page.getByTestId("cinema-model")).toBeVisible();
  await expect(page.getByTestId("cinema-go")).toBeVisible();
  await page.getByRole("button", { name: "Guided view", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await step(0); await noOverflow(page);
  await page.screenshot({ path: `${out}/05-workflows-mobile.png`, fullPage: true });
  await choose("Create a video from text");
  await page.getByLabel("Your prompt", { exact: true }).fill("A ceramic vase turns slowly on a sunlit table");
  await page.getByLabel("Generation model", { exact: true }).selectOption("wan30-t2v");
  await expect(page.getByTestId("model-cost")).toContainText("$0.50");
  await step(3);
  await page.getByRole("checkbox", { name: "Dry run" }).check();
  await page.getByRole("button", { name: "Dry run", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Test complete" })).toBeVisible();
  assert.equal(posts.filter(p => p.path === "/api/generate/jobs").at(-1)!.body.card.model, "wan30-t2v");
  await page.getByRole("checkbox", { name: "Dry run" }).uncheck();
  await step(1);
  await page.getByRole("button", { name: "Help me write this" }).click();
  await expect(page.getByLabel("Message the director")).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `${out}/06-director-mobile.png`, fullPage: true });
  await page.getByRole("button", { name: "Close director" }).click();
  await visit(`${base}/gen2?queue=longform-test`);
  await expect(page.getByRole("heading", { name: "Generate & review", exact: true })).toBeVisible();
  await expect(page.getByTestId("motion2-go")).toBeVisible();
  await visit(`${base}/gen2?workflow=i2v&queue=longform-test&cinema=cinema-test`);
  await expect(page.getByLabel("Starting image URL")).toBeVisible();
  authed = false;
  await visit(`${base}/gen2`);
  await page.getByRole("button", { name: "Start this workflow" }).click();
  await page.getByLabel("Your prompt", { exact: true }).fill("Keep this unsaved prompt after sign-in");
  await step(3);
  await expect(page.getByRole("button", { name: "Generate", exact: true })).toBeDisabled();
  authed = true;
  await page.getByRole("button", { name: "Refresh access", exact: true }).click();
  await expect(page.getByRole("button", { name: "Generate", exact: true })).toBeEnabled();
  await step(1);
  await expect(page.getByLabel("Your prompt", { exact: true })).toHaveValue("Keep this unsaved prompt after sign-in");
  assert.deepEqual(errors, []);
  console.log(`PASS: seven workflows, step persistence, source handoff, model switching and prices, dry-run payloads and per-beat protection, failed render recovery, library gate, queue planning, all controls, mobile layout, sign-in recovery. Screenshots: ${out}`);
} catch (err) {
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
  console.error((await page.locator("body").innerText()).slice(-7000));
  throw err;
} finally { await browser.close(); }

}
main().catch(error => { console.error(error); process.exitCode = 1; });
