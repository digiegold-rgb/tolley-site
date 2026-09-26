import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  discordHttpFailure,
  discordWebhookConfigError,
  leadActionLocationLines,
  leadDeliveryErrorMessage,
} from "./lead-notify.ts";

const original = process.env.PULSE_DISCORD_WEBHOOK_URL;
const logs: string[] = [];
const consoleError = console.error;

function captureLogs() {
  logs.length = 0;
  console.error = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
}

afterEach(() => {
  console.error = consoleError;
  if (original === undefined) delete process.env.PULSE_DISCORD_WEBHOOK_URL;
  else process.env.PULSE_DISCORD_WEBHOOK_URL = original;
});

describe("discord webhook failures", () => {
  it("logs a missing webhook without inventing a URL", () => {
    captureLogs();
    delete process.env.PULSE_DISCORD_WEBHOOK_URL;
    assert.equal(discordWebhookConfigError(), "PULSE_DISCORD_WEBHOOK_URL is missing");
    assert.match(logs.join("\n"), /PULSE_DISCORD_WEBHOOK_URL is missing/);
  });

  it("logs a malformed webhook and never echoes the secret", () => {
    captureLogs();
    process.env.PULSE_DISCORD_WEBHOOK_URL = "https://evil.example/api/webhooks/999/super-secret-token";
    assert.equal(discordWebhookConfigError(), "PULSE_DISCORD_WEBHOOK_URL is malformed");
    const joined = logs.join("\n");
    assert.match(joined, /PULSE_DISCORD_WEBHOOK_URL is malformed/);
    assert.equal(joined.includes("super-secret-token"), false);
    assert.equal(joined.includes("evil.example"), false);
  });

  it("accepts a discord.com webhook URL and stays quiet", () => {
    captureLogs();
    process.env.PULSE_DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1234567890/abcDEF_token-1";
    assert.equal(discordWebhookConfigError(), null);
    assert.equal(logs.length, 0);
  });

  it("keeps HTTP status and a body snippet, and redacts a webhook URL", () => {
    const url = "https://discord.com/api/webhooks/1234567890/super-secret-token";
    process.env.PULSE_DISCORD_WEBHOOK_URL = url;
    const message = discordHttpFailure(401, `{"message":"Invalid Webhook Token"} ${url}`);
    assert.match(message, /Discord webhook HTTP 401/);
    assert.match(message, /Invalid Webhook Token/);
    assert.equal(message.includes("super-secret-token"), false);
    assert.equal(leadDeliveryErrorMessage(new Error(`request failed ${url}`)).includes("super-secret-token"), false);
    assert.equal(leadDeliveryErrorMessage(new Error("Simulated outage")), "Simulated outage");
  });
});

describe("owner lead alert text", () => {
  it("includes outOfArea and ZIP", () => {
    const lines = leadActionLocationLines({ zip: "66062", outOfArea: true, unit_type: "bundle" });
    assert.deepEqual(lines, ["ZIP: 66062", "outOfArea: true"]);
  });
});
