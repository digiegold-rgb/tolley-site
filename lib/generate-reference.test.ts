import assert from "node:assert/strict";
import { it } from "node:test";
import { defaultJobCard, parseGenerateJobCard, mergeJobCard } from "./generate-job-card";
import { referenceImagePlan, referenceModelProblem } from "./generate-reference";
import { referenceImageCost } from "./generate-cost";
import { isFalImageRecipe } from "./generate-engine-card";

it("old character cards default to Modal and model choice survives edits", () => {
  const old = defaultJobCard(null, {});
  assert.equal(old.model, "qwen-modal");
  const selected = parseGenerateJobCard({ ...old, model: "flux2-edit" });
  assert.equal(mergeJobCard(selected, { prompt: "New portrait" }).model, "flux2-edit");
});
it("character alternatives submit all references and the requested image batch to their matching adapters", () => {
  for (const model of ["qwen-edit", "flux2-edit"] as const) {
    const card = { ...defaultJobCard(null, {}), model, identity_ref_urls: ["https://example.com/front.png"], extra_image_urls: ["https://example.com/style.png"], num_images: 4 };
    const plan = referenceImagePlan(card);
    assert.equal(plan.falModelId, model); assert.equal(isFalImageRecipe(plan.recipe), true);
    assert.deepEqual(plan.input.image_urls, [...card.identity_ref_urls, ...card.extra_image_urls]);
    assert.equal(plan.input.num_images, 4); assert.equal(plan.input.seed, card.seed);
    assert.equal("pipe_overrides" in plan.input, false);
    assert.equal("negative_prompt" in plan.input, model === "qwen-edit");
  }
});
it("FLUX.2 never silently drops a fifth reference and rejects unsupported small dimensions", () => {
  const card = { ...defaultJobCard(null, {}), model: "flux2-edit" as const, identity_ref_urls: ["https://example.com/1", "https://example.com/2", "https://example.com/3"], extra_image_urls: ["https://example.com/4", "https://example.com/5"] };
  assert.match(referenceModelProblem(card)!, /at most 4/);
  assert.throws(() => referenceImagePlan(card), /at most 4/);
  assert.match(referenceModelProblem({ ...card, extra_image_urls: [], width: 256 })!, /512/);
});
it("character estimate accounts for reference billing and selected model", () => {
  assert.equal(referenceImageCost("qwen-edit", 928, 1664, 3), .06);
  assert.equal(referenceImageCost("flux2-edit", 928, 1664, 3), .06);
  assert.equal(referenceImageCost("flux2-edit", 928, 1664, 1), .036000000000000004);
});
it("fal-specific step and guidance limits are checked before submission", () => {
  const card = { ...defaultJobCard(null, {}), identity_ref_urls: ["https://example.com/front.png"] };
  assert.match(referenceModelProblem({ ...card, model: "flux2-edit", num_inference_steps: 3 })!, /4–50/);
  assert.match(referenceModelProblem({ ...card, model: "qwen-edit", num_inference_steps: 80 })!, /1–50/);
  assert.match(referenceModelProblem({ ...card, model: "qwen-edit", true_cfg_scale: 0 })!, /at least 1/);
  assert.equal(referenceModelProblem({ ...card, model: "qwen-modal", num_inference_steps: 80 }), null);
});
