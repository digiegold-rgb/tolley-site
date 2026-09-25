import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyReferrer, captureAttribution, normalizeAttribution, attributionSource } from "../lib/discovery-attribution";
import { summarizeDiscovery } from "../lib/discovery-report";
import { publicOfferings, discoveryText, discoveryQuestions, discoveryFaqJsonLd } from "../lib/discovery";
import { SUBSITES, getSubsite } from "../lib/subsites";
import { SubsiteManifestSchema } from "../lib/agent-manifest";
import { buildJsonLd, serializeJsonLd } from "../lib/json-ld";
import { checkDiscoveryHealth } from "../lib/discovery-health";
import { WD_PRICE_WASHER, WD_PRICE_BUNDLE } from "../lib/wd";
import { GEN_MODEL, GEN_PRICE_DAY } from "../lib/generator";
import { preserveWebGlobals } from "../lib/preserve-web-globals";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

test("MCP transport initialization preserves responses from unrelated Next routes", async () => {
  const OriginalRequest = Request, OriginalResponse = Response;
  const existingResponse = new Response("public discovery");
  const transport = preserveWebGlobals(() => new StreamableHTTPServerTransport());
  assert.equal(Request, OriginalRequest);
  assert.equal(Response, OriginalResponse);
  assert.ok(existingResponse instanceof Response);
  await transport.close();
  assert.throws(() => preserveWebGlobals(() => { throw new Error("init failed"); }), /init failed/);
  assert.equal(Response, OriginalResponse);
});

test("AI referrers require exact domain boundaries; queries cannot spoof origin", () => {
  for (const [url, expected] of [["https://chatgpt.com/c/123", "chatgpt"], ["https://www.perplexity.ai/search/a", "perplexity"], ["https://claude.ai/chat/a", "claude"], ["https://gemini.google.com/app", "gemini"], ["https://chatgpt.com.attacker.example", "other"], ["https://example.com/?from=chatgpt.com", "other"], ["not a url", "other"], ["", "direct"]]) assert.equal(classifyReferrer(url), expected);
});
test("campaign, browser, and reported attribution remain independent and bounded", () => {
  const a = captureAttribution("https://www.tolley.io/cleanouts?utm_source=facebook&utm_campaign=fall&email=private@example.com", "https://chatgpt.com/c/private-chat");
  assert.equal(a.campaignSource, "facebook"); assert.equal(a.browserSource, "chatgpt"); assert.equal(attributionSource(a), "facebook");
  assert.equal(a.landingPath, "/cleanouts"); assert.equal(a.referrerHost, "chatgpt.com");
  assert.ok(!JSON.stringify(a).includes("private"));
  const b = normalizeAttribution({ ...a, reportedSource: "My friend", browserSource: "spoofed" })!;
  assert.equal(b.browserSource, "chatgpt"); assert.equal(b.reportedSource, "My friend");
  assert.equal(normalizeAttribution({ landingPath: "//evil", reportedSource: "a".repeat(400) })!.reportedSource!.length, 300);
  assert.equal(normalizeAttribution(null), undefined);
});
test("all offerings are covered in the directory text and have an explicit disposition", () => {
  const text = discoveryText(true);
  for (const s of SUBSITES) {
    assert.ok(s.discovery?.disposition, s.name);
    assert.equal(SubsiteManifestSchema.safeParse(s).success, true, s.name);
  }
  for (const s of publicOfferings()) {
    assert.ok(text.includes(s.discovery!.canonicalUrl), s.name);
    assert.ok(readFileSync(`app/${s.name}/page.tsx`, "utf8").includes(`PublicOfferDetails name="${s.name}"`), `${s.name} server details missing`);
  }
  assert.ok(!text.includes("## Tolley.io Billing"));
  assert.ok(!text.includes("relocating to Pennsylvania"));
});
test("correct product constants and partner contacts reach discovery manifests", () => {
  assert.deepEqual(getSubsite("wd")!.pricing!.map(p => p.amount), [WD_PRICE_WASHER, WD_PRICE_BUNDLE]);
  assert.equal(getSubsite("generator")!.pricing![0].amount, GEN_PRICE_DAY);
  assert.ok(getSubsite("generator")!.purpose.includes(GEN_MODEL));
  assert.equal(getSubsite("hvac")!.discovery!.phone, "816-726-4054");
  assert.ok(!getSubsite("rental")!.purpose.includes("furniture"));
  assert.ok(!getSubsite("rental")!.purpose.includes("picnic"));
  for (const name of ["junkinjays", "kerplunk", "tables", "moving", "e-and-t", "drive", "lastmile", "moupins", "picnic-table"]) assert.equal(getSubsite(name), undefined, `${name} was retired in the current release`);
  for (const name of ["vater", "pools", "advertising", "real-estate-agent"]) assert.ok(!publicOfferings().some(s => s.name === name), `${name} must not be re-promoted`);
});
test("unknown software pricing is never advertised as free; JSON-LD is escaped", () => {
  assert.equal(buildJsonLd(getSubsite("animate")!).offers, undefined);
  assert.equal(buildJsonLd(getSubsite("cleanouts")!).telephone, "913-283-3826");
  assert.equal(getSubsite("cleanouts")!.skipJsonLd, false);
  assert.ok(!serializeJsonLd({ text: "</script><script>alert(1)</script>" }).includes("<"));
});
test("one customer can have two opportunities without duplicate revenue", () => {
  const date = new Date("2026-09-24T12:00:00Z"), since = new Date("2026-09-01"), until = new Date("2026-10-01");
  const root = { id: "root", name: "Example", offer: "cleanouts", attribution: { reportedSource: "ChatGPT" }, referralRootId: null, discoveryStage: "estimated", createdAt: date };
  const child = { ...root, id: "child", offer: "homes", attribution: null, referralRootId: "root", discoveryStage: null };
  const payment = { leadId: "root", receiptKey: "receipt-1", amountCents: 25000, collectedAt: date };
  const summary = summarizeDiscovery([root, child], [payment, payment, { ...payment, receiptKey: "future", collectedAt: new Date("2027-01-01") }], since, until);
  assert.equal(summary.customers, 1); assert.equal(summary.collectedCents, 25000);
  assert.equal(summary.groups.length, 2); assert.equal(summary.groups.find(g => g.offering === "homes")!.source, "chatgpt");
  assert.equal(summary.groups.find(g => g.offering === "homes")!.booked, 0);
  assert.equal(summary.groups.find(g => g.offering === "cleanouts")!.estimated, 1);
});
test("old lead payments count in collection period without creating new inquiries", () => {
  const lead = { id: "old", name: "Example", offer: "wd", attribution: null, referralRootId: null, discoveryStage: "booked", createdAt: new Date("2025-01-01") };
  const summary = summarizeDiscovery([lead], [{ leadId: "old", receiptKey: "p", amountCents: 5800, collectedAt: new Date("2026-09-24") }], new Date("2026-09-01"), new Date("2026-10-01"));
  assert.equal(summary.customers, 0); assert.equal(summary.groups[0].inquiries, 0); assert.equal(summary.collectedCents, 5800);
});
test("health probe flags login redirects and missing public content", async () => {
  const fetcher = (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    const response = new Response(path === "/robots.txt" ? "User-agent: OAI-SearchBot" : "<html>Sign in</html>", { status: 200 });
    Object.defineProperty(response, "url", { value: "https://www.tolley.io/login" });
    return response;
  }) as typeof fetch;
  const results = await checkDiscoveryHealth("https://www.tolley.io", fetcher);
  assert.ok(results.find(r => r.path === "/cleanouts")!.issues.includes("Unexpected redirect"));
  assert.ok(results.find(r => r.path === "/cleanouts")!.issues.includes("Public service details missing"));
});

import { crawlAllowed } from "../lib/discovery-robots";
test("search crawler access respects named groups, longest paths, and wildcard rules", () => {
  const robots = "User-agent: *\nDisallow: /\nUser-agent: OAI-SearchBot\nAllow: /\nDisallow: /api/\nAllow: /api/public$";
  assert.equal(crawlAllowed(robots, "/cleanouts", "OAI-SearchBot"), true);
  assert.equal(crawlAllowed(robots, "/api/private", "OAI-SearchBot"), false);
  assert.equal(crawlAllowed(robots, "/api/public", "OAI-SearchBot"), true);
  assert.equal(crawlAllowed(robots, "/api/public/private", "OAI-SearchBot"), false);
  assert.equal(crawlAllowed(robots, "/cleanouts", "OtherBot"), false);
});

test("cited pages keep their query-shaped title, phone in the description, and a real FAQ (2026-09-24 win)", () => {
  const cleanouts = getSubsite("cleanouts")!;
  assert.equal(cleanouts.title, "Tolley Cleanouts — Estate & Rental Cleanouts in Kansas City");
  for (const name of ["cleanouts", "estate", "homes", "wd", "live"]) {
    const s = getSubsite(name)!;
    assert.equal(s.discovery?.disposition, "offering", name);
    assert.match(s.purpose, /913-283-3826/, `${name} description must carry the phone`);
    assert.ok((s.faq?.length ?? 0) >= 4, `${name} needs a real FAQ`);
    const qs = discoveryQuestions(s);
    assert.ok(qs.some(q => q.q === s.faq![0].q), `${name} details section must render the real FAQ`);
    const ld = discoveryFaqJsonLd(s)!;
    assert.equal(ld["@type"], "FAQPage");
    assert.equal((ld.mainEntity as unknown[]).length, s.faq!.length);
  }
  assert.equal(discoveryFaqJsonLd(getSubsite("game")!), null);
  assert.match(discoveryText(true), /Treasure Hauls Live/);
  assert.match(discoveryText(true), /Q: What does it cost to hire you\?/);
});
