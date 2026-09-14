/** Product-facing workflow metadata; engine identifiers remain API-compatible. */
export const GENERATE_WORKFLOWS = [
  { id: "t2i", title: "Create an image", description: "Start with an idea. Turn a written description into a new image.", engine: "Text → Image · FLUX", input: "A description", output: "One image", group: "Start simple" },
  { id: "i2v", title: "Animate an image", description: "Upload a still, then describe how it should move.", engine: "Image → Video · Wan", input: "An image + motion prompt", output: "A short video", group: "Start simple" },
  { id: "t2v", title: "Create a video from text", description: "Describe a scene and its movement. No starting image needed.", engine: "Text → Video · Wan", input: "A scene description", output: "Up to 5 seconds", group: "Start simple" },
  { id: "modal", title: "Create a character still", description: "Use reference photos to keep the same person while changing the scene or wardrobe.", engine: "Modal stills · Qwen Image Edit", input: "Identity reference photos", output: "1–4 images", group: "Direct every detail" },
  { id: "motion", title: "Direct a sequence", description: "Animate a starting image, add individual clips, then join the approved takes.", engine: "Motion · Wan", input: "A starting still", output: "One clip or a sequence", group: "Direct every detail" },
  { id: "motion2", title: "Build a continuous video", description: "Plan a longer take. Each clip picks up from the last frame of the previous one.", engine: "Motion 2 · Longform", input: "A still + scene plan", output: "Chained clips, up to 5 minutes", group: "Direct every detail" },
  { id: "cinema", title: "Make a cinematic film", description: "Combine reference images, a shot list, and optional audio. Review each shot before joining.", engine: "Cinema · Seedance / Kling", input: "References + a shot list", output: "A film built from shots", group: "Direct every detail" },
] as const;
export type WorkflowMode = typeof GENERATE_WORKFLOWS[number]["id"] | "v2v";
export type WorkflowStep = 0 | 1 | 2 | 3;
export const WORKFLOW_STEPS = ["Choose a workflow", "Describe & add sources", "Adjust settings", "Generate & review"] as const;
export function usableStudioImage(url: string): boolean {
  return /^https:\/\/\S+$/i.test(url.trim()) || /^\/api\/generate\/jobs\/[^/]+\/image\?i=\d+$/.test(url.trim());
}
export function workflowBlockers(input: {
  mode: WorkflowMode; prompt: string; source: string; hasFile: boolean;
  references: string[]; beatCount: number;
}): { step: WorkflowStep; message: string }[] {
  const blockers: { step: WorkflowStep; message: string }[] = [];
  if (input.mode === "v2v") return [{ step: 0, message: "Choose an available workflow. Video → Video is not available yet." }];
  if (["modal", "t2i", "t2v", "i2v", "motion"].includes(input.mode) && !input.prompt.trim())
    blockers.push({ step: 1, message: "Describe what you want to create." });
  if (["i2v", "motion", "motion2"].includes(input.mode) && !input.hasFile && !usableStudioImage(input.source))
    blockers.push({ step: 1, message: "Upload a starting image, paste an HTTPS image URL, or choose a still from your library." });
  if (input.mode === "modal" && !input.references.some(usableStudioImage))
    blockers.push({ step: 1, message: "Add an identity reference photo URL so the character stays consistent." });
  if (input.mode === "cinema" && !input.references.some(usableStudioImage))
    blockers.push({ step: 1, message: "Add at least one reference image for your film." });
  if (["motion2", "cinema"].includes(input.mode) && input.beatCount === 0)
    blockers.push({ step: 2, message: "Create your scene plan with the Plan beats button before generating." });
  return blockers;
}
