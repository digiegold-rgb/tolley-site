import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  fetchTwilioBalance,
  isLowTwilioBalance,
  parseTwilioBalanceResponse,
  TwilioBalanceConfigError,
  TwilioBalanceUpstreamError,
} from "./twilio-balance.ts";

const ORIG_SID = process.env.TWILIO_ACCOUNT_SID;
const ORIG_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const ORIG_FETCH = globalThis.fetch;

afterEach(() => {
  if (ORIG_SID === undefined) delete process.env.TWILIO_ACCOUNT_SID;
  else process.env.TWILIO_ACCOUNT_SID = ORIG_SID;
  if (ORIG_TOKEN === undefined) delete process.env.TWILIO_AUTH_TOKEN;
  else process.env.TWILIO_AUTH_TOKEN = ORIG_TOKEN;
  globalThis.fetch = ORIG_FETCH;
});

describe("parseTwilioBalanceResponse", () => {
  it("parses a string balance and drops account_sid", () => {
    const asOf = new Date("2026-08-26T16:00:00.000Z");
    const parsed = parseTwilioBalanceResponse(
      { account_sid: "ACffffffffffffffffffffffffffffffff", balance: "3.12", currency: "USD" },
      asOf,
    );
    assert.deepEqual(parsed, { balance: 3.12, currency: "USD", asOf: asOf.toISOString() });
    assert.equal("account_sid" in parsed, false);
    assert.equal(JSON.stringify(parsed).includes("AC"), false);
  });

  it("accepts a numeric balance", () => {
    const parsed = parseTwilioBalanceResponse({ balance: 12, currency: "USD" });
    assert.equal(parsed.balance, 12);
    assert.equal(parsed.currency, "USD");
  });

  it("rejects missing or non-finite balance", () => {
    assert.throws(
      () => parseTwilioBalanceResponse({ currency: "USD" }),
      TwilioBalanceUpstreamError,
    );
    assert.throws(
      () => parseTwilioBalanceResponse({ balance: "nope", currency: "USD" }),
      TwilioBalanceUpstreamError,
    );
    assert.throws(() => parseTwilioBalanceResponse(null), TwilioBalanceUpstreamError);
  });
});

describe("isLowTwilioBalance", () => {
  it("warns below $5, not at or above", () => {
    assert.equal(isLowTwilioBalance(4.99), true);
    assert.equal(isLowTwilioBalance(0), true);
    assert.equal(isLowTwilioBalance(5), false);
    assert.equal(isLowTwilioBalance(12.4), false);
  });
});

describe("fetchTwilioBalance", () => {
  it("returns 503-class error when env is missing", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    await assert.rejects(fetchTwilioBalance(), TwilioBalanceConfigError);
  });

  it("returns parsed balance and never includes account_sid", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACffffffffffffffffffffffffffffffff";
    process.env.TWILIO_AUTH_TOKEN = "secret-token-value";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      assert.match(url, /\/2010-04-01\/Accounts\/AC[0-9a-f]{32}\/Balance\.json$/);
      return new Response(
        JSON.stringify({
          account_sid: "ACffffffffffffffffffffffffffffffff",
          balance: "3.12",
          currency: "USD",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const payload = await fetchTwilioBalance();
    assert.equal(payload.balance, 3.12);
    assert.equal(payload.currency, "USD");
    assert.equal("account_sid" in payload, false);
    const dumped = JSON.stringify(payload);
    assert.equal(dumped.includes("ACffffffffffffffffffffffffffffffff"), false);
    assert.equal(dumped.includes("secret-token-value"), false);
  });

  it("maps Twilio HTTP errors to a short upstream failure", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACffffffffffffffffffffffffffffffff";
    process.env.TWILIO_AUTH_TOKEN = "secret-token-value";
    globalThis.fetch = (async () =>
      new Response("nope", { status: 500 })) as typeof fetch;
    await assert.rejects(fetchTwilioBalance(), (err: unknown) => {
      assert.ok(err instanceof TwilioBalanceUpstreamError);
      assert.equal(err.message, "Twilio balance request failed");
      assert.equal(err.message.includes("secret-token-value"), false);
      return true;
    });
  });
});
