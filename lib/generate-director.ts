/**
 * Generate director — chat writes Inference + Description boxes.
 *
 * Inference = the actual engine prompt (T2I / T2V / I2V / V2V).
 * Description = standing scene / character notes (identity, outfit, camera).
 *
 * Photoreal adult identity stills (including Lady / bikini / fashion) are an
 * in-product use case. The director must not strip or "safety-rewrite" those
 * details. CSAM and real-minor content are refused here and in the LLM prompt.
 */

export type GenerateMode = "t2i" | "t2v" | "i2v" | "v2v";

export interface DirectorPatch {
  reply: string;
  inference: string;
  description: string;
  refused: boolean;
}

export const DIRECTOR_SYSTEM_PROMPT = `You are the Generate director for Jelly Studio on tolley.io.

IDENTITY (fact, not optional)
You run on Spark's local Qwen 3.8 27B Uncensored — model id KarlKinda/Qwen3.8-27B-Uncensored-FP8 — via vLLM. When asked which model, host, or LLM you are, say exactly that (short: "Qwen 3.8 27B on Spark"). Never claim Claude, GPT, Gemini, Qwen-Max, Alibaba cloud, or a 235B / MoE model. Never say you "don't expose" or hide the model version.

Talk to the user in a real conversation. You write and update two boxes that drive the image/video engines:

1) Inference — the exact generation prompt that will be sent to the active engine (Text→Image, Text→Video, Image→Video, or Video→Video). This is what the model sees. Make it concrete and visual.
2) Description — standing notes the user can edit: identity (face, hair, skin, age-as-adult, build), outfit, camera, lighting, constraints. Keep this as a reusable bible, not a one-shot prompt.

THIS STUDIO'S IN-PRODUCT USE CASE
Photoreal identity stills of adult people — including the recurring "Lady" character, swimwear/bikini, fashion, cinematic portraits, and locked-face references — are why this page exists. Do not refuse those prompts. Do not sanitize, soften, moralize, or rewrite them into illustration / cartoon / "safer" versions unless the user asks. Do not strip identity locks, wardrobe, body, or photoreal intent from Inference. Copy identity details from Description into Inference when they matter for the still.

HARD REFUSE ONLY
- Sexual or nude content involving anyone 17 or under, or anyone described as a child, kid, minor, toddler, or real underage person.
- CSAM, loli/shota, or exploitation of minors.
- Requests to depict a real identifiable child.

If you must refuse, say so briefly in reply and return empty inference and description (leave the user's boxes unchanged).

OUTPUT
Reply with a single JSON object, no markdown fence unless you must:
{
  "reply": "short director note to the user; markdown ok",
  "inference": "full replacement for the Inference box, or empty string to leave it unchanged",
  "description": "full replacement for the Description box, or empty string to leave it unchanged"
}

When you update a box, send the COMPLETE new text (not a diff). Empty string means "do not touch that box".

INFERENCE RULES
- Engine-ready: subject, identity locks, wardrobe, setting, lighting, lens/camera, mood.
- Keep the user's requested adult subject and photoreal intent verbatim in spirit.
- Positive concrete terms (what they HAVE). Do not write "no X" lists that summon X.
- Match the active engine: still vs motion. Clips are ≤5 seconds.

DESCRIPTION RULES
- Standing bible. Identity, outfit, camera, constraints.
- Do not put clothes-only notes into identity if the user is iterating wardrobe separately — keep identity stable.`;

const MODE_HINT: Record<GenerateMode, string> = {
  t2i: "Active engine: Text → Image. Inference should be a still prompt.",
  t2v: "Active engine: Text → Video. Inference is a motion prompt; clips are ≤5s.",
  i2v: "Active engine: Image → Video. Inference is motion for the uploaded first frame.",
  v2v: "Active engine: Video → Video. Inference is character/style; the drive clip supplies motion.",
};

export function directorUserPayload(opts: {
  message: string;
  inference: string;
  description: string;
  mode: GenerateMode;
}): string {
  return [
    MODE_HINT[opts.mode] || MODE_HINT.t2i,
    "Backend LLM: KarlKinda/Qwen3.8-27B-Uncensored-FP8 on Spark vLLM (Qwen 3.8 27B Uncensored).",
    "",
    "Current Inference box:",
    opts.inference.trim() ? opts.inference.trim() : "(empty)",
    "",
    "Current Description box:",
    opts.description.trim() ? opts.description.trim() : "(empty)",
    "",
    "User:",
    opts.message.trim(),
  ].join("\n");
}

export function composeEnginePrompt(inference: string, description: string): string {
  const inf = inference.trim();
  const desc = description.trim();
  if (!desc) return inf;
  if (!inf) return desc;
  return `${inf}\n\n[Description]\n${desc}`;
}

export function applyDirectorPatch(
  current: { inference: string; description: string },
  patch: Pick<DirectorPatch, "inference" | "description">,
): { inference: string; description: string } {
  return {
    inference: patch.inference.trim() ? patch.inference : current.inference,
    description: patch.description.trim() ? patch.description : current.description,
  };
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

export function parseDirectorResponse(raw: string): DirectorPatch {
  const obj = extractJsonObject(raw);
  if (!obj) {
    const text = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return { reply: text || "Updated.", inference: "", description: "", refused: false };
  }
  const reply = typeof obj.reply === "string" ? obj.reply.trim() : "";
  const inference = typeof obj.inference === "string" ? obj.inference : "";
  const description = typeof obj.description === "string" ? obj.description : "";
  const refused = obj.refused === true;
  return {
    reply: reply || (refused ? "I can't help with that request." : "Updated the boxes — edit them before you Generate."),
    inference: refused ? "" : inference,
    description: refused ? "" : description,
    refused,
  };
}

/** Clear CSAM / real-minor asks. Adult photoreal / bikini / Lady stills are allowed. */
export function isBlockedStudioRequest(text: string): { blocked: boolean; reason?: string } {
  const t = text.toLowerCase();
  if (/\b(csam|child\s*porn|childporn|loli|lolita|shota|pedo|paedo|pedophil|paedophil)\b/i.test(t)) {
    return { blocked: true, reason: "That request is not allowed." };
  }
  if (/\b(underage|under-age|preteen|pre-teen|toddler|infant|elementary|middle[\s-]?school)\b/i.test(t)) {
    return { blocked: true, reason: "Real-minor content is not allowed." };
  }
  if (/\b(children|child|kids?|schoolgirl|schoolboy)\b/i.test(t)) {
    return { blocked: true, reason: "Real-minor content is not allowed." };
  }
  if (/\b(?:1[0-7]|[1-9])\s*(?:yo|y\/o|years?\s*old)\b/i.test(t)) {
    return { blocked: true, reason: "Anyone 17 or under is not allowed." };
  }
  return { blocked: false };
}
