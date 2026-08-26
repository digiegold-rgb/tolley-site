import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ANIMATE_HELP_VOICE_DIGITS,
  ANIMATE_SMS_DISCLOSURE,
  ANIMATE_SMS_HELP_REPLY,
  ANIMATE_SMS_NUMBER_PENDING,
  ANIMATE_SMS_OPT_IN_REPLY,
  ANIMATE_SMS_OPT_OUT_REPLY,
  ANIMATE_SMS_PRIVACY_URL,
  ANIMATE_SMS_TERMS_URL,
  WD_SMS_DIGITS,
  animateSmsDisplayNumber,
  animateSmsFromE164,
  animateSmsKeywordReply,
  animateSmsPhoneRequiredError,
  animateSmsStartLine,
  isWashDrySmsNumber,
  parseAnimateSmsLeadFields,
} from "./animate-sms.ts";

describe("animateSmsDisplayNumber", () => {
  it("prints 'number posting shortly' when env is empty", () => {
    assert.equal(animateSmsDisplayNumber(""), ANIMATE_SMS_NUMBER_PENDING);
    assert.equal(animateSmsDisplayNumber("   "), ANIMATE_SMS_NUMBER_PENDING);
    assert.equal(animateSmsDisplayNumber(undefined), ANIMATE_SMS_NUMBER_PENDING);
  });

  it("never shows the Wash & Dry 7508 number or the HELP voice line", () => {
    assert.equal(animateSmsDisplayNumber("913-600-7508"), ANIMATE_SMS_NUMBER_PENDING);
    assert.equal(animateSmsDisplayNumber("+19136007508"), ANIMATE_SMS_NUMBER_PENDING);
    assert.equal(animateSmsDisplayNumber("913-283-3826"), ANIMATE_SMS_NUMBER_PENDING);
    assert.equal(animateSmsDisplayNumber("+19132833826"), ANIMATE_SMS_NUMBER_PENDING);
    assert.equal(animateSmsStartLine("913-600-7508").includes("7508"), false);
    assert.equal(animateSmsStartLine("913-283-3826").includes("3826"), false);
  });

  it("formats a real Animate number as 913-XXX-XXXX", () => {
    assert.equal(animateSmsDisplayNumber("9135550100"), "913-555-0100");
    assert.equal(animateSmsDisplayNumber("+19135550100"), "913-555-0100");
    assert.equal(animateSmsDisplayNumber("913-555-0100"), "913-555-0100");
  });
});

describe("animateSmsFromE164", () => {
  it("returns null for empty or forbidden W/D numbers", () => {
    assert.equal(animateSmsFromE164(""), null);
    assert.equal(animateSmsFromE164("+19136007508"), null);
    assert.equal(animateSmsFromE164("+19132833826"), null);
  });

  it("accepts a distinct Animate From", () => {
    assert.equal(animateSmsFromE164("+19135550100"), "+19135550100");
  });
});

describe("keyword replies", () => {
  it("returns Jelly Studio language, never Wash & Dry", () => {
    assert.match(animateSmsKeywordReply("start") ?? "", /Jelly Studio/);
    assert.match(animateSmsKeywordReply("stop") ?? "", /Jelly Studio/);
    assert.match(animateSmsKeywordReply("help") ?? "", /Jelly Studio/);
    assert.doesNotMatch(animateSmsKeywordReply("start") ?? "", /Wash & Dry|7508/);
    assert.equal(animateSmsKeywordReply(null), null);
    assert.equal(animateSmsKeywordReply("start"), ANIMATE_SMS_OPT_IN_REPLY);
    assert.equal(animateSmsKeywordReply("stop"), ANIMATE_SMS_OPT_OUT_REPLY);
    assert.equal(animateSmsKeywordReply("help"), ANIMATE_SMS_HELP_REPLY);
  });
});

describe("parseAnimateSmsLeadFields", () => {
  it("defaults to opted out with no phone", () => {
    assert.deepEqual(parseAnimateSmsLeadFields({}), { smsOptIn: false, phone: null });
  });

  it("requires a valid US mobile when the box is checked", () => {
    const missing = parseAnimateSmsLeadFields({ smsOptIn: true });
    assert.equal(animateSmsPhoneRequiredError(missing), "A valid US mobile number is required to opt in to texts.");
    const ok = parseAnimateSmsLeadFields({ smsOptIn: true, phone: "913-555-0100" });
    assert.equal(ok.smsOptIn, true);
    assert.equal(ok.phone, "+19135550100");
    assert.equal(animateSmsPhoneRequiredError(ok), null);
  });
});

describe("disclosure copy", () => {
  it("names Jelly Studio, frequency, STOP/HELP, consent not required, and both legal URLs", () => {
    assert.match(ANIMATE_SMS_DISCLOSURE, /Jelly Studio \(Your KC Homes LLC\)/);
    assert.match(ANIMATE_SMS_DISCLOSURE, /Up to 8 msgs\/month/);
    assert.match(ANIMATE_SMS_DISCLOSURE, /Reply STOP to cancel/);
    assert.match(ANIMATE_SMS_DISCLOSURE, /Reply HELP for help/);
    assert.match(ANIMATE_SMS_DISCLOSURE, /Consent is not required to request a seat or use the studio/);
    assert.equal(ANIMATE_SMS_DISCLOSURE.includes(ANIMATE_SMS_PRIVACY_URL), true);
    assert.equal(ANIMATE_SMS_DISCLOSURE.includes(ANIMATE_SMS_TERMS_URL), true);
    assert.doesNotMatch(ANIMATE_SMS_DISCLOSURE, /7508|Wash & Dry/);
  });

  it("keeps W/D digits as constants we refuse, not as Animate copy", () => {
    assert.equal(WD_SMS_DIGITS, "9136007508");
    assert.equal(ANIMATE_HELP_VOICE_DIGITS, "9132833826");
    assert.equal(isWashDrySmsNumber("+19136007508"), true);
    assert.equal(isWashDrySmsNumber("+19135550100"), false);
  });
});
