/**
 * lib/vater/project-features.ts
 *
 * Typed access to `YouTubeProject.settingsJson` — the optional feature bag
 * from design/jelly-feature-contract-2026-08-16.md. Every key is ADDITIVE and
 * OPTIONAL: a missing key means today's behavior, so nothing here can change
 * an existing project's render.
 *
 * Storage is deliberately funnelled through this one module. Reads go through
 * `readFeatures()`; writes go through `saveFeatures()`, which PATCHes
 * `{ settings: {...partial} }` to /api/vater/youtube/[id]. That route
 * SHALLOW-MERGES, so two editor steps writing different keys in the same
 * session never clobber each other (Script writes `language`, Voiceover
 * writes `pronunciations`, another lane writes `captionPreset`, …).
 *
 * No "server-only" marker: the types + readFeatures are pure and used on both
 * sides; saveFeatures is browser-side (uses fetch with session cookies).
 */

export type FeatureLanguage =
  | "en"
  | "es"
  | "pt"
  | "fr"
  | "de"
  | "it"
  | "pl"
  | "ko"
  | "ja";

export const FEATURE_LANGUAGES: ReadonlyArray<{
  code: FeatureLanguage;
  label: string;
}> = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pl", label: "Polish" },
  { code: "ko", label: "Korean" },
  { code: "ja", label: "Japanese" },
];

const LANGUAGE_CODES = new Set<string>(FEATURE_LANGUAGES.map((l) => l.code));

export function isFeatureLanguage(value: unknown): value is FeatureLanguage {
  return typeof value === "string" && LANGUAGE_CODES.has(value);
}

/* ── Visuals / soundtrack knobs (2026-08-16) ───────────────────────────────
 * Caption presets, camera moves and transitions are Remotion props; the
 * overlay toggles are planner hints. Every one defaults to today's look. */

export const CAPTION_PRESETS = [
  { id: "clean", label: "Clean", note: "White, centered, subtle shadow" },
  { id: "bold-yellow", label: "Bold yellow", note: "Heavy yellow, black outline" },
  { id: "karaoke-pink", label: "Karaoke pink", note: "Word-by-word highlight" },
  { id: "minimal-lower", label: "Minimal lower", note: "Small, lower third" },
  { id: "boxed", label: "Boxed", note: "Text on a solid slab" },
  { id: "none", label: "No captions", note: "Burn nothing in" },
] as const;

export type CaptionPreset = (typeof CAPTION_PRESETS)[number]["id"];

const CAPTION_PRESET_IDS = new Set<string>(CAPTION_PRESETS.map((p) => p.id));

export function isCaptionPreset(value: unknown): value is CaptionPreset {
  return typeof value === "string" && CAPTION_PRESET_IDS.has(value);
}

/** Project default. "alternate" = today's behavior (planner alternates). */
export const CAMERA_DEFAULTS = [
  { id: "alternate", label: "Auto" },
  { id: "zoom-in", label: "Zoom in" },
  { id: "zoom-out", label: "Zoom out" },
  { id: "pan-l", label: "Pan L" },
  { id: "pan-r", label: "Pan R" },
  { id: "still", label: "Still" },
] as const;

export type CameraMove = (typeof CAMERA_DEFAULTS)[number]["id"];

const CAMERA_MOVE_IDS = new Set<string>(CAMERA_DEFAULTS.map((c) => c.id));

export function isCameraMove(value: unknown): value is CameraMove {
  return typeof value === "string" && CAMERA_MOVE_IDS.has(value);
}

export interface FeatureOverlays {
  charts?: boolean;
  maps?: boolean;
  headers?: boolean;
}

export interface FeatureBrandKit {
  logoUrl?: string;
  captionFont?: string;
  captionColor?: string;
  accentColor?: string;
}

/** "draft" = stills only (no i2v spend); "full" = the wan motion pass. */
export type MotionMode = "draft" | "full";

/** Longest crossfade the compositor will honor, in seconds. */
export const MAX_TRANSITION_SEC = 2;

/** The subset of the contract's feature bag this module knows how to parse.
 *  Unknown keys survive a round-trip untouched — the PATCH route shallow-
 *  merges, so a key this build doesn't know about is never dropped. */
export interface ProjectFeatures {
  /** ISO code. Non-"en" routes TTS through the multilingual path. */
  language?: FeatureLanguage;
  /** Spoken-text map, e.g. { "Tolley": "TAH-lee" }. */
  pronunciations?: Record<string, string>;
  /** BYO narration — when set the pipeline skips TTS entirely. */
  narrationUrl?: string;
  /** Burned-in caption look. Missing = "clean". */
  captionPreset?: CaptionPreset;
  /** Planner overlay opt-ins. Missing = all off. */
  overlays?: FeatureOverlays;
  /** Project-wide camera move. Missing = "alternate". */
  cameraDefault?: CameraMove;
  /** Crossfade length between scenes, 0–2. Missing/0 = hard cuts. */
  transitionSec?: number;
  /** Score the video with 2–4 mood segments instead of one track. */
  musicMoods?: boolean;
  /** "16:9" (default) or "9:16". */
  aspect?: "16:9" | "9:16";
  /** Per-project brand kit override (falls back to the style's). */
  brandKit?: FeatureBrandKit;
  /** Stills-only draft vs the full motion pass. Missing = "draft". */
  motionMode?: MotionMode;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

/**
 * Parse `project.settingsJson` into the typed shape. Anything malformed is
 * dropped rather than thrown — a bad row must never break the editor.
 */
export function readFeatures(settingsJson: unknown): ProjectFeatures {
  if (!isPlainObject(settingsJson)) return {};
  const out: ProjectFeatures = {};

  if (isFeatureLanguage(settingsJson.language)) {
    out.language = settingsJson.language;
  }

  if (isPlainObject(settingsJson.pronunciations)) {
    const map: Record<string, string> = {};
    for (const [word, phonetic] of Object.entries(
      settingsJson.pronunciations,
    )) {
      if (typeof phonetic === "string" && word.trim() && phonetic.trim()) {
        map[word] = phonetic;
      }
    }
    if (Object.keys(map).length > 0) out.pronunciations = map;
  }

  if (
    typeof settingsJson.narrationUrl === "string" &&
    settingsJson.narrationUrl.trim()
  ) {
    out.narrationUrl = settingsJson.narrationUrl.trim();
  }

  if (isCaptionPreset(settingsJson.captionPreset)) {
    out.captionPreset = settingsJson.captionPreset;
  }

  if (isPlainObject(settingsJson.overlays)) {
    const o = settingsJson.overlays;
    const overlays: FeatureOverlays = {};
    if (typeof o.charts === "boolean") overlays.charts = o.charts;
    if (typeof o.maps === "boolean") overlays.maps = o.maps;
    if (typeof o.headers === "boolean") overlays.headers = o.headers;
    if (Object.keys(overlays).length > 0) out.overlays = overlays;
  }

  if (isCameraMove(settingsJson.cameraDefault)) {
    out.cameraDefault = settingsJson.cameraDefault;
  }

  if (
    typeof settingsJson.transitionSec === "number" &&
    Number.isFinite(settingsJson.transitionSec)
  ) {
    out.transitionSec = Math.max(
      0,
      Math.min(MAX_TRANSITION_SEC, settingsJson.transitionSec),
    );
  }

  if (typeof settingsJson.musicMoods === "boolean") {
    out.musicMoods = settingsJson.musicMoods;
  }

  if (settingsJson.aspect === "16:9" || settingsJson.aspect === "9:16") {
    out.aspect = settingsJson.aspect;
  }

  if (isPlainObject(settingsJson.brandKit)) {
    const brandKit = readBrandKit(settingsJson.brandKit);
    if (brandKit) out.brandKit = brandKit;
  }

  if (settingsJson.motionMode === "draft" || settingsJson.motionMode === "full") {
    out.motionMode = settingsJson.motionMode;
  }

  return out;
}

/**
 * Parse a brand kit off either `YouTubeStyle.brandKitJson` or a project's
 * `features.brandKit`. Returns null when nothing usable is set, so callers can
 * omit the key entirely rather than send `{}` downstream.
 *
 * Strings only, trimmed, length-capped: these values are interpolated into
 * Remotion styles on the DGX side, and a 40KB "font name" is never legitimate.
 */
export function readBrandKit(value: unknown): FeatureBrandKit | null {
  if (!isPlainObject(value)) return null;
  const out: FeatureBrandKit = {};
  const str = (v: unknown, max: number): string | undefined => {
    if (typeof v !== "string") return undefined;
    const s = v.trim().slice(0, max);
    return s || undefined;
  };
  const logoUrl = str(value.logoUrl, 600);
  // Only http(s) — a `javascript:`/`data:` "logo" has no business reaching a
  // renderer or a published page.
  if (logoUrl && /^https?:\/\//i.test(logoUrl)) out.logoUrl = logoUrl;
  const captionFont = str(value.captionFont, 80);
  if (captionFont) out.captionFont = captionFont;
  const captionColor = str(value.captionColor, 32);
  if (captionColor) out.captionColor = captionColor;
  const accentColor = str(value.accentColor, 32);
  if (accentColor) out.accentColor = accentColor;
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Persist a PARTIAL feature patch. `null` on a key clears it server-side.
 * Throws on a non-2xx so the caller can surface a real message (no silent
 * failures — feedback_silent_failures_leads.md).
 */
export async function saveFeatures(
  projectId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`/api/vater/youtube/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings: patch }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Could not save settings (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
    );
  }
}
