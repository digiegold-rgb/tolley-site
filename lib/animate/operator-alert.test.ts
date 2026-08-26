import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  JELLY_OPERATOR_EMAIL,
  JELLY_OPERATOR_EMAIL_BCC,
  JELLY_OPERATOR_SMS_FROM,
  JELLY_OPERATOR_SMS_TO,
  WD_A2P_MESSAGING_SERVICE_SID,
  buildOperatorEmail,
  buildOperatorSmsBody,
  buildOperatorSmsParams,
  sendOperatorSeatSms,
} from "./operator-alert.ts";

const ORIG_SID = process.env.TWILIO_ACCOUNT_SID;
const ORIG_TOKEN = process.env.TWILIO_AUTH_TOKEN;

afterEach(() => {
  if (ORIG_SID === undefined) delete process.env.TWILIO_ACCOUNT_SID;
  else process.env.TWILIO_ACCOUNT_SID = ORIG_SID;
  if (ORIG_TOKEN === undefined) delete process.env.TWILIO_AUTH_TOKEN;
  else process.env.TWILIO_AUTH_TOKEN = ORIG_TOKEN;
});

describe("buildOperatorSmsBody", () => {
  it("stays at or under 160 characters and includes the short want", () => {
    const body = buildOperatorSmsBody({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+15555550100",
      want: "cooking shorts",
    });
    assert.ok(body.length <= 160);
    assert.match(body, /^Jelly seat:/);
    assert.match(body, /jane@example.com/);
    assert.match(body, /cooking shorts/);
    assert.doesNotMatch(body, /MessagingServiceSid/);
  });

  it("truncates a long want instead of overflowing", () => {
    const body = buildOperatorSmsBody({
      name: "A Very Long Requester Name That Eats The Budget",
      email: "averylongemailaddress.for.testing@example.com",
      phone: "+19135551212",
      want: "I want to make a cinematic documentary about every street in Kansas City with cloned voice and no stock footage ".repeat(4),
    });
    assert.ok(body.length <= 160, body);
    assert.match(body, /^Jelly seat:/);
  });
});

describe("buildOperatorSmsParams", () => {
  it("texts only Jared from the raw From number — never a Messaging Service or the requester", () => {
    const requesterPhone = "+15555550199";
    const params = buildOperatorSmsParams(
      buildOperatorSmsBody({
        name: "Pat",
        email: "pat@example.com",
        phone: requesterPhone,
        want: "true-crime shorts",
      }),
    );
    const raw = params.toString();
    assert.equal(params.get("To"), JELLY_OPERATOR_SMS_TO);
    assert.equal(params.get("From"), JELLY_OPERATOR_SMS_FROM);
    assert.equal(params.has("MessagingServiceSid"), false);
    assert.equal(raw.includes("MessagingServiceSid"), false);
    assert.equal(raw.includes(WD_A2P_MESSAGING_SERVICE_SID), false);
    assert.notEqual(params.get("To"), requesterPhone);
    assert.match(params.get("Body") ?? "", /\+15555550199/);
  });
});

describe("buildOperatorEmail", () => {
  it("mails Jared and bcc's digie — never the requester as To", () => {
    const mail = buildOperatorEmail({
      name: "Sam Rivera",
      email: "sam@example.com",
      phone: "+15555550123",
      want: "kids stories",
      source: { utm_source: "fb" },
      referrer: "https://www.facebook.com/",
    });
    assert.equal(mail.to, JELLY_OPERATOR_EMAIL);
    assert.equal(mail.bcc, JELLY_OPERATOR_EMAIL_BCC);
    assert.equal(mail.subject, "Jelly seat request — Sam Rivera");
    assert.match(mail.text, /sam@example.com/);
    assert.match(mail.text, /kids stories/);
    assert.notEqual(mail.to, "sam@example.com");
  });
});

describe("sendOperatorSeatSms", () => {
  it("returns skipped and does not call Twilio when env is missing", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    let called = 0;
    const fakeFetch: typeof fetch = async () => {
      called += 1;
      throw new Error("should not fetch");
    };
    const result = await sendOperatorSeatSms("Jelly seat: test", fakeFetch);
    assert.equal(result.status, "skipped");
    assert.equal(called, 0);
  });

  it("POSTs Messages.json to Jared only — no MessagingServiceSid, never requester To", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACffffffffffffffffffffffffffffffff";
    process.env.TWILIO_AUTH_TOKEN = "test-token";
    const requesterPhone = "+15555550999";
    const body = buildOperatorSmsBody({
      name: "Lee",
      email: "lee@example.com",
      phone: requesterPhone,
      want: "nature films",
    });
    let url = "";
    let rawBody = "";
    const fakeFetch: typeof fetch = async (input, init) => {
      url = String(input);
      rawBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ sid: "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    };
    const result = await sendOperatorSeatSms(body, fakeFetch);
    assert.equal(result.status, "sent");
    assert.match(url, /\/2010-04-01\/Accounts\/AC[a-f0-9]+\/Messages\.json$/);
    assert.equal(rawBody.includes("MessagingServiceSid"), false);
    assert.equal(rawBody.includes(WD_A2P_MESSAGING_SERVICE_SID), false);
    const posted = new URLSearchParams(rawBody);
    assert.equal(posted.get("To"), JELLY_OPERATOR_SMS_TO);
    assert.equal(posted.get("From"), JELLY_OPERATOR_SMS_FROM);
    assert.notEqual(posted.get("To"), requesterPhone);
  });
});
