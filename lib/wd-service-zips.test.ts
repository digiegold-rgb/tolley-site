import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  WD_BORDERLINE_ZIPS,
  WD_OUT_OF_AREA_MESSAGE,
  WD_SERVICE_ZIPS,
  isWdServiceZip,
  normalizeWdZip,
  prepareWdQuoteFields,
  wdCheckoutZipDecision,
} from "./wd-service-zips.ts";

describe("isWdServiceZip", () => {
  it("accepts Independence 64055 and normalizes ZIP+4 and whitespace", () => {
    assert.equal(isWdServiceZip("64055"), true);
    assert.equal(isWdServiceZip(" 64055 "), true);
    assert.equal(isWdServiceZip("64055-1234"), true);
    assert.equal(normalizeWdZip(" 64055-1234 "), "64055");
  });

  it("rejects Olathe 66062 and short input", () => {
    assert.equal(isWdServiceZip("66062"), false);
    assert.equal(isWdServiceZip(""), false);
    assert.equal(isWdServiceZip("6405"), false);
    assert.equal(normalizeWdZip("abc"), null);
  });

  it("lists each allowlisted ZIP once", () => {
    assert.equal(new Set(WD_SERVICE_ZIPS).size, WD_SERVICE_ZIPS.length);
    for (const zip of WD_SERVICE_ZIPS) assert.match(zip, /^\d{5}$/);
    assert.ok(WD_SERVICE_ZIPS.includes("64052"));
    assert.ok(!WD_SERVICE_ZIPS.includes("66062"));
  });

  it("does not allow borderline ZIPs, including ones just over 25 minutes", () => {
    assert.ok(WD_BORDERLINE_ZIPS.length > 0);
    const allowed = new Set<string>(WD_SERVICE_ZIPS);
    for (const zip of WD_BORDERLINE_ZIPS) {
      assert.match(zip, /^\d{5}$/);
      assert.equal(allowed.has(zip), false);
      assert.equal(isWdServiceZip(zip), false);
    }
    assert.equal(isWdServiceZip("64081"), false);
    assert.equal(isWdServiceZip("64029"), false);
    assert.equal(isWdServiceZip("64118"), false);
    assert.equal(isWdServiceZip("64013"), false);
  });

  it("keeps included minutes at or under 25 and borderline minutes through 30, both sorted", () => {
    const source = readFileSync(new URL("./wd-service-zips.ts", import.meta.url), "utf8");
    function rows(exportName: string) {
      const block = source.split(`export const ${exportName}`)[1]?.split("] as const")[0] ?? "";
      return [...block.matchAll(/\/\/ .+, (\d+\.\d) min\n\s+"(\d{5})"/g)].map((match) => ({
        minutes: Number(match[1]),
        zip: match[2],
      }));
    }
    const included = rows("WD_SERVICE_ZIPS");
    const borderline = rows("WD_BORDERLINE_ZIPS");
    assert.deepEqual(included.map((row) => row.zip), [...WD_SERVICE_ZIPS]);
    assert.deepEqual(borderline.map((row) => row.zip), [...WD_BORDERLINE_ZIPS]);
    assert.equal(included[0]?.zip, "64052");
    assert.equal(included[0]?.minutes, 0);
    for (let i = 0; i < included.length; i++) {
      assert.ok(included[i].minutes <= 25);
      if (i > 0) assert.ok(included[i].minutes >= included[i - 1].minutes);
    }
    for (let i = 0; i < borderline.length; i++) {
      assert.ok(borderline[i].minutes > 25 && borderline[i].minutes <= 30);
      if (i > 0) assert.ok(borderline[i].minutes >= borderline[i - 1].minutes);
    }
  });
});

describe("server-side ZIP rejection", () => {
  it("rejects a missing ZIP before a checkout session would be created", () => {
    const missing = wdCheckoutZipDecision("   ");
    assert.equal(missing.ok, false);
    if (missing.ok) return;
    assert.equal(missing.status, 400);
    assert.equal(missing.outOfArea, undefined);
    assert.match(missing.error, /five-digit/i);
  });

  it("rejects Olathe with the exact out-of-area message and does not treat it as allowed", () => {
    const olathe = wdCheckoutZipDecision("66062");
    assert.equal(olathe.ok, false);
    if (olathe.ok) return;
    assert.equal(olathe.status, 422);
    assert.equal(olathe.outOfArea, true);
    assert.equal(olathe.error, WD_OUT_OF_AREA_MESSAGE);
  });

  it("allows Independence 64055 through to checkout", () => {
    const allowed = wdCheckoutZipDecision("64055");
    assert.deepEqual(allowed, { ok: true, zip: "64055" });
  });

  it("stores out-of-area quotes with the normalized ZIP instead of the client flag", () => {
    const saved = prepareWdQuoteFields({ zip: "66062", unit_type: "bundle", outOfArea: false, notes: "Olathe" });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(saved.zip, "66062");
    assert.equal(saved.outOfArea, true);
    assert.equal(saved.fields.outOfArea, true);
    assert.equal(saved.fields.zip, "66062");
    assert.equal(saved.fields.unit_type, "bundle");

    const inside = prepareWdQuoteFields({ zip: "64055-0000", unit_type: "washer" });
    assert.equal(inside.ok, true);
    if (!inside.ok) return;
    assert.equal(inside.fields.zip, "64055");
    assert.equal(inside.fields.outOfArea, false);
  });

  it("checks the ZIP in the checkout route before Stripe is called", () => {
    const route = readFileSync(new URL("../app/api/wd/checkout/route.ts", import.meta.url), "utf8");
    const decisionAt = route.indexOf("wdCheckoutZipDecision");
    const stripeAt = route.indexOf("checkout.sessions.create");
    assert.ok(decisionAt >= 0 && stripeAt > decisionAt);
    assert.match(route, /subscription_data:\s*\{\s*metadata\s*\}/);
    assert.match(route, /metadata,/);
    const leadRoute = readFileSync(new URL("../app/api/lead/action/route.ts", import.meta.url), "utf8");
    assert.match(leadRoute, /prepareWdQuoteFields/);
    const mcp = readFileSync(new URL("./mcp-tools.ts", import.meta.url), "utf8");
    assert.match(mcp, /prepareWdQuoteFields/);
  });
});
