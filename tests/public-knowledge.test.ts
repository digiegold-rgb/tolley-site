import test from "node:test";
import assert from "node:assert/strict";
import { publicKnowledge } from "../lib/company/public-knowledge";
import { publicOfferings } from "../lib/discovery";
import { WD_PRICE_WASHER, WD_PRICE_BUNDLE } from "../lib/wd";
import { GEN_FAQ } from "../lib/generator";
import { TR_FAQ } from "../lib/trailer";

test("anonymous questions return current sourced washer/dryer prices without a database or worker", () => {
  assert.equal(publicKnowledge("washer")[0].id, "catalog:wd");
  assert.equal(publicKnowledge("trailer")[0].id, "catalog:trailer");
  const rows = publicKnowledge("How much does it cost to rent a washer and dryer?");
  assert.equal(rows[0].id, "catalog:wd");
  const facts = JSON.parse(rows[0].body);
  assert.deepEqual(facts.pricing.map((p: { amount: number }) => p.amount), [WD_PRICE_WASHER, WD_PRICE_BUNDLE]);
  assert.deepEqual(rows[0].sources, ["https://www.tolley.io/wd"]);
  assert.equal(rows[0].audience, "public");
  assert.match(facts.availability, /confirm/i);
});
test("unknown requests stay empty and private applications never become answers", () => {
  assert.deepEqual(publicKnowledge("xylophone-quasar-zebrafish"), []);
  const allowed = new Set(publicOfferings().map(s => `catalog:${s.name}`));
  for (const q of ["", "billing", "hq", "customer", "rent", "video"]) {
    for (const row of publicKnowledge(q)) assert.ok(allowed.has(row.id));
  }
});
test("generator and trailer answers reuse the public FAQ sources", () => {
  for (const [name, faq] of [["generator", GEN_FAQ], ["trailer", TR_FAQ]] as const) {
    const row = publicKnowledge(name).find(r => r.id === `catalog:${name}`)!;
    const facts = JSON.parse(row.body);
    for (const answer of faq) assert.ok(facts.questions.some((q: {q: string; a: string}) => q.q === answer.q && q.a === answer.a));
  }
  assert.ok(!TR_FAQ.some(f => f.a.includes("insurance covers the trailer")));
});
