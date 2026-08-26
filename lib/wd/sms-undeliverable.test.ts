import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isDeadSmsErrorCode,
  isFailedDeliveryStatus,
  shouldFlagTwilioStatus,
  twilioErrorCodeOf,
} from "./sms-undeliverable-codes.ts";

describe("isDeadSmsErrorCode", () => {
  it("flags Twilio 30003 and 30005 only", () => {
    assert.equal(isDeadSmsErrorCode(30003), true);
    assert.equal(isDeadSmsErrorCode("30005"), true);
    assert.equal(isDeadSmsErrorCode("30007"), false);
    assert.equal(isDeadSmsErrorCode(null), false);
    assert.equal(isDeadSmsErrorCode(""), false);
  });
});

describe("shouldFlagTwilioStatus", () => {
  it("requires undelivered/failed plus a dead error code", () => {
    assert.equal(shouldFlagTwilioStatus("undelivered", "30003"), true);
    assert.equal(shouldFlagTwilioStatus("failed", 30005), true);
    assert.equal(shouldFlagTwilioStatus("delivered", "30003"), false);
    assert.equal(shouldFlagTwilioStatus("undelivered", "30007"), false);
    assert.equal(shouldFlagTwilioStatus("queued", null), false);
  });
});

describe("isFailedDeliveryStatus", () => {
  it("is case-insensitive", () => {
    assert.equal(isFailedDeliveryStatus("UNDELIVERED"), true);
    assert.equal(isFailedDeliveryStatus("Failed"), true);
    assert.equal(isFailedDeliveryStatus("sent"), false);
  });
});

describe("twilioErrorCodeOf", () => {
  it("reads Twilio RestException.code", () => {
    assert.equal(twilioErrorCodeOf({ code: 30003 }), "30003");
    assert.equal(twilioErrorCodeOf(new Error("nope")), null);
  });
});
