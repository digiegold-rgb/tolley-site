import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanoutConversion, measurementDenied, openAIReference } from "../lib/openai-ad-attribution";
import { cleanoutAdReference } from "../lib/openai-ad-browser";
import { reportCleanoutConversion } from "../lib/openai-ad-conversions";

const originalKey = process.env.OPENAI_ADS_CONVERSIONS_KEY;
const originalPixel = process.env.OPENAI_ADS_PIXEL_ID;
const globals = ["window", "navigator", "sessionStorage"] as const;
const descriptors = globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
afterEach(() => {
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  if (originalKey === undefined) delete process.env.OPENAI_ADS_CONVERSIONS_KEY;
  else process.env.OPENAI_ADS_CONVERSIONS_KEY = originalKey;
  if (originalPixel === undefined) delete process.env.OPENAI_ADS_PIXEL_ID;
  else process.env.OPENAI_ADS_PIXEL_ID = originalPixel;
});

function browser() {
  const values = new Map<string, string>();
  const location = { search: "" };
  const nav = { globalPrivacyControl: true, doNotTrack: "0" };
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  for (const [key, value] of Object.entries({ window: { location }, navigator: nav, sessionStorage: storage })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  cleanoutAdReference(); // clear memory between cases through the real opt-out path
  nav.globalPrivacyControl = false;
  return { values, location, nav };
}

test("preserves an opaque click ID and sends only a saved-lead event, no customer data or revenue", () => {
  assert.equal(openAIReference("opaque_A+b=/"), "opaque_A+b=/");
  for (const bad of [null, {}, "", "bad\nref", "x".repeat(4097)]) assert.equal(openAIReference(bad), undefined);
  assert.equal(cleanoutConversion("", "ref"), undefined);
  assert.equal(cleanoutConversion("saved-id", undefined), undefined);
  assert.deepEqual(cleanoutConversion("saved-id", "opaque_A+b=/", 123), {
    id: "cleanouts_quote_saved-id", type: "lead_created", timestamp_ms: 123,
    oppref: "opaque_A+b=/", source_url: "https://www.tolley.io/cleanouts",
    action_source: "web", opt_out: true, data: { type: "customer_action" },
  });
});

test("retains the ad reference across navigation without copying arbitrary query data", () => {
  const { location, values } = browser();
  location.search = "?oppref=opaque_A%2Bb%3D%2F&phone=private&email=private";
  assert.equal(cleanoutAdReference(), "opaque_A+b=/");
  location.search = "";
  assert.equal(cleanoutAdReference(), "opaque_A+b=/");
  assert.ok(!JSON.stringify([...values]).includes("private"));
});

test("GPC and DNT clear browser references and server signals deny measurement", () => {
  const { location, values, nav } = browser();
  location.search = "?oppref=reference";
  assert.equal(cleanoutAdReference(), "reference");
  nav.globalPrivacyControl = true;
  assert.equal(cleanoutAdReference(), undefined);
  assert.equal(values.size, 0);
  nav.globalPrivacyControl = false;
  nav.doNotTrack = "1";
  assert.equal(cleanoutAdReference(), undefined);
  assert.equal(measurementDenied("1", null), true);
  assert.equal(measurementDenied(null, "1"), true);
  assert.equal(measurementDenied(null, null), false);
});

test("expired or corrupt stored identifiers are not reused", () => {
  const { values } = browser();
  values.set("tolley.cleanouts.openai-click.v1", JSON.stringify({ reference: "expired", capturedAt: Date.now() - 31 * 86400000 }));
  assert.equal(cleanoutAdReference(), undefined);
  values.set("tolley.cleanouts.openai-click.v1", "bad json");
  assert.equal(cleanoutAdReference(), undefined);
});

test("restricted storage does not break capture or quote submission", () => {
  const { location } = browser();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("blocked"); } });
  location.search = "?oppref=current";
  assert.equal(cleanoutAdReference(), "current");
  location.search = "";
  assert.equal(cleanoutAdReference(), "current");
});

test("unconfigured or unattributed submissions make no conversion network request", async () => {
  delete process.env.OPENAI_ADS_CONVERSIONS_KEY;
  const fail = (async () => { throw new Error("should not run"); }) as typeof fetch;
  assert.equal(await reportCleanoutConversion("saved", "reference", fail), "skipped");
  process.env.OPENAI_ADS_CONVERSIONS_KEY = "test-key";
  process.env.OPENAI_ADS_PIXEL_ID = "test-pixel";
  assert.equal(await reportCleanoutConversion("saved", undefined, fail), "skipped");
});

test("transient delivery failures retry the identical event for deduplication", async () => {
  process.env.OPENAI_ADS_CONVERSIONS_KEY = "test-key";
  process.env.OPENAI_ADS_PIXEL_ID = "test-pixel";
  const bodies: string[] = [];
  const fetcher = (async (url, options) => {
    assert.equal(url, "https://bzr.openai.com/v1/events?pid=test-pixel");
    bodies.push(String(options?.body));
    if (bodies.length === 1) throw new Error("network unavailable");
    return new Response("{}", { status: bodies.length === 2 ? 503 : 200 });
  }) as typeof fetch;
  assert.equal(await reportCleanoutConversion("saved", "reference", fetcher), "sent");
  assert.equal(bodies.length, 3);
  assert.equal(new Set(bodies).size, 1);
});

test("delivery failures stay bounded and do not throw into the lead flow", async () => {
  process.env.OPENAI_ADS_CONVERSIONS_KEY = "test-key";
  process.env.OPENAI_ADS_PIXEL_ID = "test-pixel";
  let attempts = 0;
  const fetcher = (async () => { attempts++; return new Response("invalid", { status: 400 }); }) as typeof fetch;
  assert.equal(await reportCleanoutConversion("saved", "reference", fetcher), "failed");
  assert.equal(attempts, 1);
});
