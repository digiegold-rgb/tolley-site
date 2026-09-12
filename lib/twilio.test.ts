import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTwilioSendIdentity } from "./twilio.ts";

describe("resolveTwilioSendIdentity", () => {
  it("uses From phone when messagingServiceSid is omitted, empty, or whitespace", () => {
    assert.deepEqual(resolveTwilioSendIdentity(), { from: "phone" });
    assert.deepEqual(resolveTwilioSendIdentity(undefined), { from: "phone" });
    assert.deepEqual(resolveTwilioSendIdentity(""), { from: "phone" });
    assert.deepEqual(resolveTwilioSendIdentity("   "), { from: "phone" });
  });

  it("uses a Messaging Service only when a non-empty SID is passed", () => {
    assert.deepEqual(resolveTwilioSendIdentity("MG82db38fc4ae258c8869e4f0ae6c525ed"), {
      messagingServiceSid: "MG82db38fc4ae258c8869e4f0ae6c525ed",
    });
    assert.deepEqual(resolveTwilioSendIdentity("  MG_explicit  "), {
      messagingServiceSid: "MG_explicit",
    });
  });
});
