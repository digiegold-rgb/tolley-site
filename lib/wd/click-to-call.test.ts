import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import { tolleyThemeForPath } from "../tolley-theme.ts";
import { WD_AGENT_E164, WD_VOICE_E164 } from "./call-numbers.ts";
import {
  bridgeTwiml,
  dialTwiml,
  isJaredBridgeLeg,
  mergeDialContacts,
  parseDialTarget,
  readDialTicket,
  rejectTwiml,
  signDialTicket,
  twilioWebhookUrl,
} from "./click-to-call.ts";

const SECRET = "test-secret";

describe("parseDialTarget", () => {
  it("accepts Joshua Perez and formats 10-digit input", () => {
    assert.deepEqual(parseDialTarget("+17373360266"), { ok: true, phone: "+17373360266" });
    assert.deepEqual(parseDialTarget("(737) 336-0266"), { ok: true, phone: "+17373360266" });
  });

  it("refuses Jared's cell and the Wash & Dry line", () => {
    const agent = parseDialTarget(WD_AGENT_E164);
    const line = parseDialTarget("913-600-7508");
    assert.equal(agent.ok, false);
    assert.equal(line.ok, false);
    if (!agent.ok) assert.match(agent.error, /your cell/);
    if (!line.ok) assert.match(line.error, /Wash & Dry/);
  });

  it("refuses junk and non-US numbers", () => {
    assert.equal(parseDialTarget("").ok, false);
    assert.equal(parseDialTarget("123").ok, false);
    assert.equal(parseDialTarget("+447911123456").ok, false);
    assert.equal(parseDialTarget("0115551234").ok, false);
  });
});

describe("dial ticket", () => {
  it("round-trips and rejects expiry, tamper, and the wrong secret", () => {
    const exp = 2_000_000_000;
    const token = signDialTicket({ to: "+17373360266", name: "Joshua Perez", exp }, SECRET);
    assert.deepEqual(readDialTicket(token, SECRET, exp - 5), {
      to: "+17373360266",
      name: "Joshua Perez",
      exp,
    });
    assert.equal(readDialTicket(token, SECRET, exp + 1), null);
    assert.equal(readDialTicket(token, "other", exp - 5), null);
    const [payload, sig] = token.split("~");
    const flipped = payload.endsWith("A") ? "B" : "A";
    assert.equal(readDialTicket(`${payload.slice(0, -1)}${flipped}~${sig}`, SECRET, exp - 5), null);
  });

  it("will not honor a signed ticket whose target was Jared", () => {
    const exp = 2_000_000_000;
    const forged = Buffer.from(JSON.stringify({ to: WD_AGENT_E164, name: "", exp })).toString("base64url");
    const sig = createHmac("sha256", SECRET).update(forged).digest("base64url");
    assert.equal(readDialTicket(`${forged}~${sig}`, SECRET, exp - 1), null);
  });
});

describe("bridge leg", () => {
  it("accepts the outbound leg to Jared and rejects an inbound call to the Wash & Dry number", () => {
    assert.equal(
      isJaredBridgeLeg({ From: WD_VOICE_E164, To: WD_AGENT_E164 }),
      true,
    );
    assert.equal(
      isJaredBridgeLeg({ Caller: "+1 (913) 600-7508", Called: "913-283-3826" }),
      true,
    );
    assert.equal(
      isJaredBridgeLeg({ From: "+17373360266", To: WD_VOICE_E164, Direction: "inbound" }),
      false,
    );
  });
});

describe("TwiML", () => {
  it("bridge announces and redirects, and does not dial", () => {
    const xml = bridgeTwiml("https://www.tolley.io/api/wd/voice/dial/abc", "Joshua & Perez");
    assert.match(xml, /Connecting you to Joshua &amp; Perez\./);
    assert.match(xml, /<Redirect method="POST">https:\/\/www\.tolley\.io\/api\/wd\/voice\/dial\/abc<\/Redirect>/);
    assert.equal(xml.includes("<Dial"), false);
    assert.equal(xml.includes("<Number"), false);
  });

  it("dial uses the Wash & Dry caller ID as From and the tenant as Number", () => {
    const xml = dialTwiml("+17373360266");
    assert.match(xml, /callerId="\+19136007508"/);
    assert.match(xml, /<Number>\+17373360266<\/Number>/);
    assert.equal(xml.includes(WD_AGENT_E164), false);
    assert.match(xml, /answerOnBridge="true"/);
  });

  it("reject hangs up without dialing", () => {
    const xml = rejectTwiml();
    assert.match(xml, /<Hangup\/>/);
    assert.equal(xml.includes("<Dial"), false);
  });
});

describe("contacts and site chrome", () => {
  it("puts Joshua first and drops the agent number", () => {
    const list = mergeDialContacts([
      { id: "1", name: "Ada", phone: "8165550142", address: "1 Main", active: true },
      { id: "2", name: "Jared", phone: WD_AGENT_E164, address: null, active: true },
      { id: "3", name: "Joshua Perez", phone: "+1 737-336-0266", address: "unit", active: true },
    ]);
    assert.equal(list[0]?.name, "Joshua Perez");
    assert.equal(list[0]?.quick, true);
    assert.equal(list.some((c) => c.phone === WD_AGENT_E164), false);
    assert.equal(list.filter((c) => c.phone === "+17373360266").length, 1);
    assert.equal(list.some((c) => c.name === "Ada"), true);
  });

  it("keeps /wd/call off the public marketing frame", () => {
    assert.equal(tolleyThemeForPath("/wd/call"), null);
    assert.equal(tolleyThemeForPath("/wd")?.kind, "service");
  });

  it("builds an absolute webhook url", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.tolley.io";
    try {
      assert.equal(
        twilioWebhookUrl("/api/wd/voice/bridge?t=abc~def"),
        "https://www.tolley.io/api/wd/voice/bridge?t=abc~def",
      );
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });
});
