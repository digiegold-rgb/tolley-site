/**
 * Shared Animate render helpers (P0 2026-08-30).
 *
 * Pure + client-safe. Routes and the Script Review screen use these so the
 * own-script path cannot park a priced click, seed cinematic, or drop
 * Narrative quality the way the post-#66 hunt found.
 */

/** UI / script-gate default. Worker fallback without this is Action (`modal-wan22`). */
export const SCRIPT_GATE_ANIM_QUALITY = "modal-wan22-narrative" as const;

export type ProduceEngine = "auto" | "fable5";

/** Create step 5 omits engine (parks at awaiting_engine). Script Review sends one. */
export function parseProduceEngine(value: unknown): ProduceEngine | null {
  return value === "auto" || value === "fable5" ? value : null;
}

/**
 * After the free approve CAS, Script Review must kick produce. The stepped
 * Create flow still parks — it sends no engine and lands on step 6.
 */
export function approveScriptFollowThrough(body: { engine?: unknown }):
  | { kick: "produce"; engine: ProduceEngine }
  | { kick: "park" } {
  const engine = parseProduceEngine(body.engine);
  if (engine) return { kick: "produce", engine };
  return { kick: "park" };
}

/**
 * Style columns the row must carry so DGX matches Jeff/Linda / Finance Pixar
 * instead of the schema default `stylePreset: "cinematic"` (F5-7HR425).
 */
export function styleSeedFromStyle(style: {
  artStylePresetId?: string | null;
  voice?: string | null;
  voiceCloneId?: string | null;
}): {
  stylePreset?: string;
  voiceName: string | null;
  voiceCloneId: string | null;
} {
  return {
    ...(style.artStylePresetId ? { stylePreset: style.artStylePresetId } : {}),
    voiceName: style.voice ?? null,
    voiceCloneId: style.voiceCloneId ?? null,
  };
}

/**
 * Hybrid opening window → worker style extras. Without `animQuality` the
 * worker falls back to Action (`modal-wan22`, $1.50/clip). Narrative is the
 * UI default (`modal-wan22-narrative`, ~$0.80).
 */
export function scriptGateAnimFields(animUntilS: number | null | undefined): {
  defaultAnimUntilS?: number;
  animQuality?: typeof SCRIPT_GATE_ANIM_QUALITY;
} {
  if (typeof animUntilS === "number" && animUntilS > 0) {
    return {
      defaultAnimUntilS: animUntilS,
      animQuality: SCRIPT_GATE_ANIM_QUALITY,
    };
  }
  return {};
}
