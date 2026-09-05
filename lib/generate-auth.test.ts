import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveGenerateActor,
  signGenerateWebhook,
  verifyGenerateWebhook,
} from "./generate-auth-core.ts";

describe("resolveGenerateActor", () => {
  it("prefers HQ PIN, then shop admin, then allowlist email", () => {
    assert.equal(
      resolveGenerateActor({ hqRole: "tolley", shopAdmin: true, adminEmail: "jared@tolley.io" }),
      "hq:tolley",
    );
    assert.equal(
      resolveGenerateActor({ hqRole: null, shopAdmin: true, adminEmail: "jared@tolley.io" }),
      "shop-admin",
    );
    assert.equal(
      resolveGenerateActor({ hqRole: null, shopAdmin: false, adminEmail: "Jared@Tolley.io" }),
      "jared@tolley.io",
    );
    assert.equal(
      resolveGenerateActor({ hqRole: null, shopAdmin: false, adminEmail: null }),
      null,
    );
  });
});

describe("verifyGenerateWebhook", () => {
  const secret = "whsec_test_generate";
  const raw = `{"job_id":"abc","status":"done"}`;

  it("accepts HMAC header and bearer token", () => {
    const sig = signGenerateWebhook(raw, secret);
    assert.equal(
      verifyGenerateWebhook(raw, new Headers({ "x-generate-signature": sig }), secret),
      true,
    );
    assert.equal(
      verifyGenerateWebhook(raw, new Headers({ authorization: `Bearer ${secret}` }), secret),
      true,
    );
    assert.equal(
      verifyGenerateWebhook(raw, new Headers({ "x-generate-signature": "nope" }), secret),
      false,
    );
    assert.equal(verifyGenerateWebhook(raw, new Headers(), secret), false);
    assert.equal(
      verifyGenerateWebhook(raw, new Headers({ authorization: `Bearer ${secret}` }), ""),
      false,
    );
  });
});
