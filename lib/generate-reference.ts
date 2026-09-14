import type { GenerateJobCard } from "./generate-job-card";

export function referenceModelProblem(card: GenerateJobCard): string | null {
  if (card.model === "qwen-modal") return null;
  const count = card.identity_ref_urls.length + card.extra_image_urls.length;
  if (!count) return "Add a reference photo before generating a character still.";
  if (card.num_inference_steps > 50 || (card.model === "flux2-edit" && card.num_inference_steps < 4)) return card.model === "flux2-edit" ? "FLUX.2 supports 4–50 inference steps. Adjust Steps or choose Modal Qwen." : "Qwen on fal.ai supports 1–50 inference steps. Adjust Steps or choose Modal Qwen.";
  if (card.model === "qwen-edit" && card.true_cfg_scale < 1) return "Qwen on fal.ai requires True CFG of at least 1.";
  if (card.model === "flux2-edit" && count > 4) return "FLUX.2 accepts at most 4 reference photos total. Remove references or choose Qwen.";
  if (card.model === "flux2-edit" && (card.width < 512 || card.height < 512)) return "FLUX.2 requires width and height of at least 512 pixels.";
  return null;
}

/** Provider-specific payload: advanced Modal controls stay saved on the card. */
export function referenceImagePlan(card: GenerateJobCard) {
  if (card.model === "qwen-modal") throw new Error("Use the Modal adapter for this model.");
  const problem = referenceModelProblem(card);
  if (problem) throw new Error(problem);
  return {
    recipe: card.model === "qwen-edit" ? "fal-qwen-edit" : "fal-flux2-edit",
    falModelId: card.model,
    input: {
      prompt: card.prompt,
      image_urls: [...card.identity_ref_urls, ...card.extra_image_urls],
      image_size: { width: card.width, height: card.height },
      num_images: card.num_images,
      num_inference_steps: card.num_inference_steps,
      guidance_scale: card.model === "qwen-edit" ? card.true_cfg_scale : card.guidance_scale,
      seed: card.seed,
      output_format: "png",
      ...(card.model === "qwen-edit" ? { negative_prompt: card.negative_prompt } : {}),
    },
  };
}
