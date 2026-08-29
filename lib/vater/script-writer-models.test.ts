import test from "node:test";
import assert from "node:assert/strict";
import {
  SCRIPT_WRITER_MARKUP,
  SCRIPT_WRITER_MODELS,
  SCRIPT_WRITER_PRODUCT_DEFAULT,
  TREY_ANIMATE_EMAIL,
  defaultScriptWriterModel,
  estimateTokensFromText,
  expectedOutputTokens,
  formatScriptCents,
  isTreyAnimateEmail,
  parseScriptWriterCharge,
  quoteScriptUsage,
  readLastScriptCharge,
} from "./script-writer-models";

test("product default is Sonnet; Trey's Animate email defaults to Fable", () => {
  assert.equal(SCRIPT_WRITER_PRODUCT_DEFAULT, "sonnet");
  assert.equal(defaultScriptWriterModel(null), "sonnet");
  assert.equal(defaultScriptWriterModel("someone@example.com"), "sonnet");
  assert.equal(isTreyAnimateEmail(TREY_ANIMATE_EMAIL), true);
  assert.equal(isTreyAnimateEmail("TVater326@gmail.com"), true);
  assert.equal(defaultScriptWriterModel(TREY_ANIMATE_EMAIL), "fable");
  assert.equal(defaultScriptWriterModel("not-trey@gmail.com"), "sonnet");
});

test("published token rates match the Aug 2026 Anthropic card", () => {
  assert.equal(SCRIPT_WRITER_MODELS.fable.inputUsdPerMTok, 10);
  assert.equal(SCRIPT_WRITER_MODELS.fable.outputUsdPerMTok, 50);
  assert.equal(SCRIPT_WRITER_MODELS.opus.inputUsdPerMTok, 5);
  assert.equal(SCRIPT_WRITER_MODELS.opus.outputUsdPerMTok, 25);
  assert.equal(SCRIPT_WRITER_MODELS.sonnet.inputUsdPerMTok, 2);
  assert.equal(SCRIPT_WRITER_MODELS.sonnet.outputUsdPerMTok, 10);
  assert.equal(SCRIPT_WRITER_MARKUP, 1.3);
});

test("quote = published rate × tokens; billed = ceil(provider × 1.30)", () => {
  // 100k in + 20k out on Sonnet: $0.20 + $0.20 = $0.40 provider → $0.52 billed
  const q = quoteScriptUsage("sonnet", 100_000, 20_000);
  assert.equal(q.providerCostCents, 40);
  assert.equal(q.billedCents, 52);
  assert.equal(q.markup, 1.3);

  // Fable is 5× Sonnet on both meters.
  const f = quoteScriptUsage("fable", 100_000, 20_000);
  assert.equal(f.providerCostCents, 200);
  assert.equal(f.billedCents, 260);

  // Switching model is a new quote — never the old 25¢ cap.
  assert.ok(f.billedCents !== 25);
  assert.ok(q.billedCents !== 25);
});

test("tiny jobs still bill a cent when there is real usage — never silently $0", () => {
  // 200 in + 80 out on Sonnet ≈ $0.0012 provider → 1¢ billed after markup.
  const q = quoteScriptUsage("sonnet", 200, 80);
  assert.ok(q.providerCostCents >= 1);
  assert.ok(q.billedCents >= q.providerCostCents);
  assert.equal(quoteScriptUsage("sonnet", 0, 0).billedCents, 0);
});

test("token estimate is 1.3 × words; empty source is 0", () => {
  assert.equal(estimateTokensFromText(""), 0);
  assert.equal(estimateTokensFromText("   "), 0);
  assert.equal(estimateTokensFromText("one two three four five ten"), 8);
  assert.equal(expectedOutputTokens(450), Math.ceil(450 * 1.3));
});

test("persisted charge round-trips quoted vs billed", () => {
  const charge = parseScriptWriterCharge({
    at: "2026-08-29T00:00:00.000Z",
    model: "opus",
    apiId: "claude-opus-5",
    source: "edited",
    fidelity: "faithful",
    quotedCents: 18,
    billedCents: 21,
    providerCostCents: 16,
    inputTokens: 1200,
    outputTokens: 800,
    markup: 1.3,
    usageId: "usage_1",
  });
  assert.ok(charge);
  assert.equal(charge!.quotedCents, 18);
  assert.equal(charge!.billedCents, 21);
  assert.equal(charge!.source, "edited");
  assert.equal(readLastScriptCharge({ writer: charge }).billedCents, 21);
  assert.equal(formatScriptCents(21), "$0.21");
});
