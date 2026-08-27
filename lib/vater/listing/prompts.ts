/**
 * lib/vater/listing/prompts.ts — site-side prompt builders for Listing Studio.
 *
 * ⚠️ PREVIEW ONLY. The DGX (content-autopilot/vater_listing.py) builds the
 * authoritative prompt from `style / roomType / look / durationS`; these
 * copies exist so the wizard can show "what we'll ask for" and so the
 * compliance lint has a concrete string to scan. Keep the skeleton in sync
 * with the Part A recipe: geometry constraints FIRST, timecoded beats,
 * diegetic audio only, no people, no layout changes.
 *
 * Zero imports beyond types — safe on the client.
 */
import type { ListingEngine, ListingLook, ListingSku } from "@/lib/vater/listing-pricing";

export interface PromptJobLike {
  sku?: ListingSku | null;
  roomType?: string | null;
  style?: string | null;
  look?: ListingLook | null;
  engine?: ListingEngine | null;
  sourceKind?: "upload" | "streetview" | string | null;
  durationS?: number | null;
  reel?: boolean | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  features?: string[] | null;
}

/** Locks the geometry — the single most important line in every prompt. */
export const GEOMETRY_LOCK =
  "Do NOT change the room layout, ceiling height, window placement, wall positions, door positions or camera angle. Keep the exact perspective of the source photo.";

export const HOUSE_STYLE =
  "Photorealistic real-estate photography, natural daylight, accurate white balance, no people, no pets, no text, no logos, no watermarks, no floating objects.";

const LOOK_LINE: Record<ListingLook, string> = {
  photoreal: "Photoreal finish — indistinguishable from a listing photo.",
  render3d: "Clean architectural 3D-render look, soft global illumination, crisp edges.",
  blueprint: "Blueprint / line-art overlay look: white linework on deep blue, furniture drawn as plan symbols.",
  bw: "Black and white editorial photograph, rich tonal range.",
};

function clean(v: string | null | undefined, max = 120): string {
  return (v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Still-stage prompt (nano-banana-2 / Qwen-Image-Edit): furnish the room as
 * PERSONAL property only. Used for `virtual_staging` and as the end-frame
 * for every video SKU.
 */
export function buildStagePrompt(job: PromptJobLike): string {
  const room = clean(job.roomType) || "room";
  const style = clean(job.style) || "warm modern";
  const look = LOOK_LINE[job.look ?? "photoreal"];
  const exterior = job.sku === "exterior_reveal";
  if (exterior) {
    return [
      "Improve the curb appeal of this exterior photo with landscaping and finishes only.",
      GEOMETRY_LOCK,
      "Keep the house footprint, roofline, windows, driveway, street and every neighbouring structure exactly as photographed. Do not add views, water, hills or skylines.",
      `Style: ${style}. Fresh lawn, tidy beds, clean walkway, front door as-is.`,
      look,
      HOUSE_STYLE,
    ].join(" ");
  }
  return [
    `Virtually stage this empty ${room} as a furnished, move-in-ready space.`,
    GEOMETRY_LOCK,
    "Add only personal property: furniture, rugs, lamps, art, plants, textiles. Keep the existing floors, walls, trim, windows, fixtures and finishes exactly as photographed.",
    `Style: ${style}. Scale every piece correctly for the room; leave natural walking paths.`,
    look,
    HOUSE_STYLE,
  ].join(" ");
}

function beats(durationS: number, room: string): string[] {
  const t = (s: number) => String(Math.round(s)).padStart(2, "0");
  const q = durationS / 4;
  return [
    `${t(0)}–${t(q)}s: the bare ${room} exactly as in the first frame, soft daylight from the windows.`,
    `${t(q)}–${t(2 * q)}s: walls and ceiling finish cleanly; light warms.`,
    `${t(2 * q)}–${t(3 * q)}s: flooring and textiles settle in from the windows toward camera.`,
    `${t(3 * q)}–${t(durationS)}s: furniture, lighting and art settle into place — matches the end frame exactly; final frame equals the end frame.`,
  ];
}

/**
 * Video-stage prompt (Seedance 2.5 i2v with end frame / Modal Wan FLF2V).
 * Seedance 8-part formula with timecodes; one continuous take, locked
 * tripod, slow push-in; end frame = the approved staged still.
 */
export function buildVideoPrompt(job: PromptJobLike): string {
  const sku = job.sku ?? "before_after";
  const room = clean(job.roomType) || "room";
  const duration = Math.max(4, Math.min(30, Math.round(job.durationS ?? (sku === "beauty_shot" ? 5 : 12))));
  const aspect = job.reel ? "9:16" : "16:9";
  const look = LOOK_LINE[job.look ?? "photoreal"];
  const head = `${duration} seconds, ${aspect}, single continuous take, locked tripod, very slow push-in.`;
  const lock = `Preserve the exact ${room} geometry, window placement, ceiling height and camera angle from the first frame throughout.`;
  const audio = "Audio: quiet room tone only, no music, no voice.";
  const tail = "No layout changes, no extra windows, no floating objects, no subtitles, no camera spin, no people.";

  if (sku === "beauty_shot") {
    return [head, lock, `The ${room} exactly as photographed; light shifts gently as the camera glides forward.`, look, HOUSE_STYLE, audio, tail].join(" ");
  }
  if (sku === "exterior_reveal") {
    return [
      `${duration} seconds, ${aspect}, single continuous take, slow drone rise from eye level to a gentle high angle.`,
      "Preserve the house footprint, roofline, windows, driveway and every neighbouring structure from the first frame.",
      "Golden-hour daylight, no added views, no sky replacement.",
      look,
      HOUSE_STYLE,
      "Audio: light outdoor ambience only, no music, no voice.",
      tail,
    ].join(" ");
  }
  if (sku === "walkthrough") {
    return [
      `${Math.max(4, Math.min(8, duration))} seconds, ${aspect}, single continuous take, steady gimbal glide forward through the ${room}.`,
      lock,
      "The room exactly as photographed.",
      look,
      HOUSE_STYLE,
      audio,
      tail,
    ].join(" ");
  }
  // before_after (default)
  return [head, lock, ...beats(duration, room), look, HOUSE_STYLE, audio, tail].join(" ");
}

/** Both prompts, for `VaterListingJob.promptJson`. */
export function buildPromptJson(job: PromptJobLike): { stage: string; video: string | null; builtAt: string } {
  return {
    stage: buildStagePrompt(job),
    video: job.sku === "virtual_staging" ? null : buildVideoPrompt(job),
    builtAt: new Date().toISOString(),
  };
}
