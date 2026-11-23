import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NET_PRICE_LINES, PRICING_PLACEHOLDER, TN_PHONE, netJsonLd, netPriceLines, parseNetQuote } from "../lib/net";

const publicFiles = [
  "lib/net.ts",
  "app/net/page.tsx",
  "app/net/agent.ts",
  "app/net/layout.tsx",
  "components/net/quote-form.tsx",
  "app/api/net/quote/route.ts",
];

test("pricing placeholder renders nothing and public copy has no currency amount", () => {
  assert.equal(PRICING_PLACEHOLDER, null);
  assert.deepEqual(netPriceLines(), ["Free consult", "Custom quote after consult"]);
  assert.deepEqual(NET_PRICE_LINES, ["Free consult", "Custom quote after consult"]);
  for (const file of publicFiles) {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(src, /\$\d|\bUSD\b|\bdollars?\b/i, file);
  }
});

test("quote validation keeps a reachable lead and rejects an empty one", () => {
  const empty = parseNetQuote({});
  assert.equal(empty.ok, false);
  const badEmail = parseNetQuote({ email: "not-an-email" });
  assert.equal(badEmail.ok, false);
  const shortPhone = parseNetQuote({ phone: "123" });
  assert.equal(shortPhone.ok, false);

  const saved = parseNetQuote({
    name: "Ada Gamer",
    phone: "816-555-0100",
    email: "ada@example.com",
    city: "Independence",
    problem: "Ping spikes in the upstairs bedrooms",
    gaming: "yes",
    devices: "Two PCs and a console",
    preferredTime: "Saturday morning",
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.value.email, "ada@example.com");
  assert.equal(saved.value.city, "Independence");
  assert.equal(saved.value.gaming, true);
  assert.match(saved.value.notes, /Project needs: Ping spikes/);
  assert.match(saved.value.notes, /Gaming: yes/);
  assert.match(saved.value.notes, /Devices: Two PCs and a console/);
  assert.match(saved.value.notes, /Preferred time: Saturday morning/);

  const nameOnly = parseNetQuote({ name: "No Phone" });
  assert.equal(nameOnly.ok, false);
  assert.equal(parseNetQuote({ name: "Unreachable", phone: "123", email: "invalid" }).ok, false);
  const emailOnly = parseNetQuote({ email: "owner@example.com", phone: "abc", projectType: "Small business", organization: "Example Office", timeline: "Next month" });
  assert.equal(emailOnly.ok, true);
  if (emailOnly.ok) {
    assert.equal(emailOnly.value.phone, "");
    assert.match(emailOnly.value.notes, /Project type: Small business/);
    assert.match(emailOnly.value.notes, /Business \/ organization: Example Office/);
    assert.match(emailOnly.value.notes, /Project timing: Next month/);
  }

  const typed = parseNetQuote({ phone: "8165550199", email: "bad email", gaming: "NO" });
  assert.equal(typed.ok, true);
  if (!typed.ok) return;
  assert.equal(typed.value.email, "");
  assert.equal(typed.value.gaming, false);
  assert.match(typed.value.notes, /Email as typed: bad email/);

  const longName = parseNetQuote({ name: "A".repeat(500), phone: "8165550100" });
  assert.equal(longName.ok, true);
  if (!longName.ok) return;
  assert.equal(longName.value.name.length, 120);
});

test("JSON-LD names Jared, the phone, and both service areas, with no price", () => {
  const graph = netJsonLd()["@graph"] as Record<string, unknown>[];
  const business = graph.find(node => node["@type"] === "LocalBusiness")!;
  const service = graph.find(node => node["@type"] === "Service")!;
  assert.equal(business.telephone, TN_PHONE);
  assert.equal(service.telephone, TN_PHONE);
  assert.equal((business.founder as { name: string }).name, "Jared Tolley");
  assert.equal((service.provider as { name: string }).name, "Jared Tolley");
  const areas = JSON.stringify(business.areaServed);
  assert.match(areas, /Independence/);
  assert.match(areas, /Kansas City metro/);
  assert.equal(JSON.stringify(service.areaServed), areas);
  assert.equal("price" in business, false);
  assert.equal("offers" in business, false);
  assert.equal("offers" in service, false);
  assert.doesNotMatch(JSON.stringify(netJsonLd()), /\$\d/);
});
