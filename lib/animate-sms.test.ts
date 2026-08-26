import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ANIMATE_HELP_VOICE_DIGITS,
  ANIMATE_SMS_DISCLOSURE,
  ANIMATE_SMS_DISPLAY_DEFAULT,
  ANIMATE_SMS_FROM_DEFAULT,
  ANIMATE_SMS_HELP_REPLY,
  ANIMATE_SMS_MESSAGING_SERVICE_SID,
  ANIMATE_SMS_OPT_IN_REPLY,
  ANIMATE_SMS_OPT_OUT_REPLY,
  ANIMATE_SMS_PHONE_SID,
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
  it("hardcodes 913-914-9429 when env is empty so TCR can click a live number", () => {
    assert.equal(animateSmsDisplayNumber(""), ANIMATE_SMS_DISPLAY_DEFAULT);
    assert.equal(animateSmsDisplayNumber("   "), ANIMATE_SMS_DISPLAY_DEFAULT);
    assert.equal(animateSmsDisplayNumber(undefined), ANIMATE_SMS_DISPLAY_DEFAULT);
    assert.equal(ANIMATE_SMS_DISPLAY_DEFAULT, "913-914-9429");
  });

  it("never shows the Wash & Dry 7508 number or the HELP voice line", () => {
    assert.equal(animateSmsDisplayNumber("913-600-7508"), ANIMATE_SMS_DISPLAY_DEFAULT);
    assert.equal(animateSmsDisplayNumber("+19136007508"), ANIMATE_SMS_DISPLAY_DEFAULT);
    assert.equal(animateSmsDisplayNumber("913-283-3826"), ANIMATE_SMS_DISPLAY_DEFAULT);
    assert.equal(animateSmsDisplayNumber("+19132833826"), ANIMATE_SMS_DISPLAY_DEFAULT);
    assert.equal(animateSmsStartLine("913-600-7508").includes("7508"), false);
    assert.equal(animateSmsStartLine("913-283-3826").includes("3826"), false);
    assert.match(animateSmsStartLine(""), /913-914-9429/);
  });

  it("lets env override with a different valid number", () => {
    assert.equal(animateSmsDisplayNumber("9135550100"), "913-555-0100");
    assert.equal(animateSmsDisplayNumber("+19135550100"), "913-555-0100");
    assert.equal(animateSmsDisplayNumber("913-555-0100"), "913-555-0100");
    assert.equal(animateSmsDisplayNumber("913-914-9429"), "913-914-9429");
    assert.equal(animateSmsDisplayNumber("+19139149429"), "913-914-9429");
  });
});

describe("animateSmsFromE164", () => {
  it("defaults to +19139149429 when empty or a forbidden W/D number", () => {
    assert.equal(animateSmsFromE164(""), ANIMATE_SMS_FROM_DEFAULT);
    assert.equal(animateSmsFromE164("+19136007508"), ANIMATE_SMS_FROM_DEFAULT);
    assert.equal(animateSmsFromE164("+19132833826"), ANIMATE_SMS_FROM_DEFAULT);
    assert.equal(ANIMATE_SMS_FROM_DEFAULT, "+19139149429");
  });

  it("accepts a distinct Animate From override", () => {
    assert.equal(animateSmsFromE164("+19135550100"), "+19135550100");
  });

  it("records the bought sender ids without treating them as a campaign submit", () => {
    assert.equal(ANIMATE_SMS_PHONE_SID, "PN25da93f610855a1412223e622678bb48");
    assert.equal(ANIMATE_SMS_MESSAGING_SERVICE_SID, "MG446284f555a5d1731f5deae2d8b46c40");
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
