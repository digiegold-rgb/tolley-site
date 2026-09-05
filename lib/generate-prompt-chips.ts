/**
 * Location / Hair / Camera chips for Modal stills.
 *
 * Same durable-marker pattern as Allow NSFW (`[[allow-nsfw-wardrobe]]`):
 * chips rewrite one labeled section of the job-card prompt, replace any
 * existing block for that dimension, and Clear removes it. Identity
 * sentences ("same adult woman as the three grey-shirt…") stay untouched.
 *
 * Prompt-first only — no Extra-image auto-wiring, no Modal kwargs.
 */

import { GENERATE_PRESETS } from "./generate-job-card";

export type PromptChipDimension = "location" | "hair" | "camera";

export type PromptChipOption = {
  id: string;
  label: string;
  /** Full labeled sentence written inside the marker. Empty = Clear. */
  line: string;
};

export const LOCATION_MARKER_START = "[[location]]";
export const LOCATION_MARKER_END = "[[/location]]";
export const HAIR_MARKER_START = "[[hair]]";
export const HAIR_MARKER_END = "[[/hair]]";
export const CAMERA_MARKER_START = "[[camera]]";
export const CAMERA_MARKER_END = "[[/camera]]";

export const LOCATION_CHIPS: PromptChipOption[] = [
  { id: "clear", label: "Clear", line: "" },
  {
    id: "soft-studio",
    label: "Soft studio",
    line: "Location: soft even studio, seamless muted backdrop, gentle key light, clean tasteful background, shallow DOF.",
  },
  {
    id: "bedroom-daylight",
    label: "Bedroom daylight",
    line: "Location: soft daylight bedroom, sheer curtains, warm window light, shallow DOF background.",
  },
  {
    id: "golden-hour-outdoor",
    label: "Golden hour outdoor",
    line: "Location: golden hour outdoor, warm low sun, soft rim light, natural environment, shallow DOF background.",
  },
  {
    id: "city-street-night",
    label: "City street night",
    line: "Location: city street at night, wet pavement reflections, neon and sodium practicals, shallow DOF background.",
  },
  {
    id: "beach-coastal",
    label: "Beach / coastal",
    line: "Location: coastal beach, open sky, soft daylight, sand and water bokeh, shallow DOF background.",
  },
  {
    id: "luxury-hotel",
    label: "Luxury hotel room",
    line: "Location: luxury hotel room, warm practical lamps, upscale interiors, shallow DOF background.",
  },
];

export const HAIR_CHIPS: PromptChipOption[] = [
  { id: "clear", label: "Clear", line: "" },
  {
    id: "soft-waves",
    label: "Hair down soft waves",
    line: "Hair: long hair down past shoulders, soft waves, natural color.",
  },
  {
    id: "straight-sleek",
    label: "Straight sleek",
    line: "Hair: long hair down, straight and sleek, natural color, healthy shine.",
  },
  {
    id: "high-ponytail",
    label: "High ponytail",
    line: "Hair: high ponytail, smooth and pulled back, natural color.",
  },
  {
    id: "loose-bun",
    label: "Loose bun",
    line: "Hair: loose bun, soft face-framing pieces, natural color.",
  },
  {
    id: "wet-look",
    label: "Wet look",
    line: "Hair: wet-look hair, sleek and damp, natural color, photoreal water sheen.",
  },
  {
    id: "shoulder-bob",
    label: "Shoulder-length bob",
    line: "Hair: shoulder-length bob, clean cut, natural color, soft movement.",
  },
];

export const CAMERA_CHIPS: PromptChipOption[] = [
  { id: "clear", label: "Clear", line: "" },
  {
    id: "eye-level-85",
    label: "Eye-level 85mm",
    line: "Camera: vertical 9:16, eye-level, 85mm, classic portrait, shallow depth of field.",
  },
  {
    id: "low-angle-35",
    label: "Low angle 35mm",
    line: "Camera: vertical 9:16, low angle, 35mm, looking up slightly, shallow depth of field.",
  },
  {
    id: "high-angle",
    label: "High angle looking down",
    line: "Camera: vertical 9:16, high angle looking down, 50mm, shallow depth of field.",
  },
  {
    id: "three-quarter",
    label: "Three-quarter / slight profile",
    line: "Camera: vertical 9:16, three-quarter view, slight profile, 85mm, eye-level, shallow depth of field.",
  },
  {
    id: "close-up",
    label: "Close-up face+shoulders",
    line: "Camera: vertical 9:16, close-up face and shoulders, 85mm, eye-level, shallow depth of field.",
  },
  {
    id: "full-body",
    label: "Full-body wide",
    line: "Camera: vertical 9:16, full-body, wider 35mm, eye-level, subject fully in frame.",
  },
];

const DIMENSIONS: Record<
  PromptChipDimension,
  { start: string; end: string; label: string; chips: PromptChipOption[] }
> = {
  location: {
    start: LOCATION_MARKER_START,
    end: LOCATION_MARKER_END,
    label: "Location",
    chips: LOCATION_CHIPS,
  },
  hair: {
    start: HAIR_MARKER_START,
    end: HAIR_MARKER_END,
    label: "Hair",
    chips: HAIR_CHIPS,
  },
  camera: {
    start: CAMERA_MARKER_START,
    end: CAMERA_MARKER_END,
    label: "Camera",
    chips: CAMERA_CHIPS,
  },
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeChipText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/\.+$/, "");
}

function tidyPrompt(prompt: string): string {
  return prompt.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function labeledSentenceRe(label: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(label)}:\\s*[^\\n.]+\\.`, "i");
}

function extractLabeledSentence(prompt: string, label: string): string | null {
  const match = prompt.match(labeledSentenceRe(label));
  return match ? match[0].trim() : null;
}

function replaceLabeledSentence(prompt: string, label: string, sentence: string): string {
  const re = labeledSentenceRe(label);
  if (!re.test(prompt)) return prompt;
  const next = sentence.trim().replace(/\.+$/, "") + ".";
  return prompt.replace(re, next);
}

function removeLabeledSentence(prompt: string, label: string): string {
  return prompt.replace(new RegExp(`\\s*\\b${escapeRegExp(label)}:\\s*[^\\n.]+\\.`, "i"), " ");
}

function chipById(chips: PromptChipOption[], id: string): PromptChipOption | undefined {
  return chips.find((c) => c.id === id);
}

function isChipSentence(sentence: string, chips: PromptChipOption[]): boolean {
  const key = normalizeChipText(sentence);
  return chips.some((c) => c.line && normalizeChipText(c.line) === key);
}

function presetPromptFor(card: { preset?: string | null }): string | null {
  const id = (card.preset || "").trim();
  if (!id) return null;
  return GENERATE_PRESETS.find((p) => p.id === id)?.prompt ?? null;
}

export function extractPromptChipBlock(prompt: string, dimension: PromptChipDimension): string | null {
  const { start, end } = DIMENSIONS[dimension];
  const re = new RegExp(
    `${escapeRegExp(start)}([\\s\\S]*?)${escapeRegExp(end)}`,
    "i",
  );
  const match = prompt.match(re);
  return match ? match[1].trim() : null;
}

export function hasPromptChipBlock(prompt: string, dimension: PromptChipDimension): boolean {
  const { start } = DIMENSIONS[dimension];
  return new RegExp(escapeRegExp(start), "i").test(prompt);
}

/** Remove the marked block (and orphan tags) for one dimension. */
export function stripPromptChipBlock(prompt: string, dimension: PromptChipDimension): string {
  const { start, end } = DIMENSIONS[dimension];
  const blockRe = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`, "gi");
  const orphanStartRe = new RegExp(`${escapeRegExp(start)}[\\s\\S]*`, "gi");
  const orphanEndRe = new RegExp(escapeRegExp(end), "gi");
  let next = prompt.replace(blockRe, "");
  next = next.replace(orphanStartRe, "");
  next = next.replace(orphanEndRe, "");
  return tidyPrompt(next);
}

function upsertPromptChipBlock(prompt: string, dimension: PromptChipDimension, line: string): string {
  const { start, end } = DIMENSIONS[dimension];
  const cleaned = stripPromptChipBlock(prompt, dimension);
  const block = [start, line, end].join("\n");
  return cleaned ? `${cleaned}\n\n${block}` : block;
}

/**
 * Active chip id from the durable marker.
 * No marker → "clear". Marker that does not match a curated line → "".
 */
export function promptChipId(prompt: string, dimension: PromptChipDimension): string {
  const inner = extractPromptChipBlock(prompt, dimension);
  if (inner == null || inner === "") return "clear";
  const hit = DIMENSIONS[dimension].chips.find(
    (c) => c.line && normalizeChipText(c.line) === normalizeChipText(inner),
  );
  return hit?.id ?? "";
}

function applyPromptChip<T extends { prompt: string; preset?: string | null }>(
  card: T,
  dimension: PromptChipDimension,
  id: string,
): T {
  const { label, chips } = DIMENSIONS[dimension];
  const option = chipById(chips, id);
  if (!option || option.id === "clear" || !option.line) {
    return clearPromptChip(card, dimension);
  }

  let prompt = stripPromptChipBlock(card.prompt, dimension);
  prompt = replaceLabeledSentence(prompt, label, option.line);
  prompt = upsertPromptChipBlock(prompt, dimension, option.line);
  return { ...card, prompt };
}

function clearPromptChip<T extends { prompt: string; preset?: string | null }>(
  card: T,
  dimension: PromptChipDimension,
): T {
  const { label, chips } = DIMENSIONS[dimension];
  let prompt = stripPromptChipBlock(card.prompt, dimension);
  const current = extractLabeledSentence(prompt, label);
  if (current && isChipSentence(current, chips)) {
    const original = presetPromptFor(card)
      ? extractLabeledSentence(presetPromptFor(card)!, label)
      : null;
    if (original && !isChipSentence(original, chips)) {
      prompt = replaceLabeledSentence(prompt, label, original);
    } else if (!original) {
      prompt = removeLabeledSentence(prompt, label);
    }
  }
  return { ...card, prompt: tidyPrompt(prompt) };
}

export function applyLocation<T extends { prompt: string; preset?: string | null }>(
  card: T,
  id: string,
): T {
  return applyPromptChip(card, "location", id);
}

export function applyHair<T extends { prompt: string; preset?: string | null }>(
  card: T,
  id: string,
): T {
  return applyPromptChip(card, "hair", id);
}

export function applyCamera<T extends { prompt: string; preset?: string | null }>(
  card: T,
  id: string,
): T {
  return applyPromptChip(card, "camera", id);
}

export function clearLocation<T extends { prompt: string; preset?: string | null }>(card: T): T {
  return clearPromptChip(card, "location");
}

export function clearHair<T extends { prompt: string; preset?: string | null }>(card: T): T {
  return clearPromptChip(card, "hair");
}

export function clearCamera<T extends { prompt: string; preset?: string | null }>(card: T): T {
  return clearPromptChip(card, "camera");
}
