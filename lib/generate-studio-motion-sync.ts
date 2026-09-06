/**
 * Motion tab: the form (source / prompt / end / slow-mo) IS Beat 1.
 * Filmstrip Beat 1 highlights that form — it must not host a second prompt.
 */

import {
  addBeat,
  applyLocalBeatPatch,
  beatFromMotionCard,
  emptyBeat,
  type BeatQueue,
  type MotionBeat,
} from "./generate-beats";
import {
  emptyMotionCard,
  type GenerateMotionCard,
  type MotionAspect,
  type MotionResolution,
} from "./generate-motion-card";

export type StudioMotionCard = GenerateMotionCard | ReturnType<typeof emptyMotionCard>;

export type MotionBeatFields = {
  prompt: string;
  negative_prompt: string;
  source_image_url: string;
  end_image_url: string;
  aspect: MotionAspect;
  seconds: number;
  resolution: MotionResolution;
  audio: boolean;
  seed: number;
  slow_mo: boolean;
};

export function motionFieldsFromCard(card: StudioMotionCard): MotionBeatFields {
  return {
    prompt: card.prompt,
    negative_prompt: card.negative_prompt,
    source_image_url: card.source_image_url,
    end_image_url: card.end_image_url || "",
    aspect: card.aspect,
    seconds: card.seconds,
    resolution: card.resolution || "720p",
    audio: card.audio === true,
    seed: card.seed,
    slow_mo: card.slow_mo === true,
  };
}

/** Beat 1 → form. Empty source is allowed (same as emptyMotionCard). */
export function motionCardFromBeatLoose(beat: MotionBeat): ReturnType<typeof emptyMotionCard> {
  return {
    ...emptyMotionCard(),
    prompt: beat.prompt,
    negative_prompt: beat.negative_prompt,
    source_image_url: beat.source_image_url,
    end_image_url: beat.end_image_url,
    aspect: beat.aspect,
    seconds: beat.seconds,
    resolution: beat.resolution,
    audio: beat.audio,
    seed: beat.seed,
    slow_mo: beat.slow_mo,
  };
}

export function motionCardMatchesBeat1(card: StudioMotionCard, queue: BeatQueue): boolean {
  const beat = queue.beats[0];
  if (!beat) return false;
  const a = motionFieldsFromCard(card);
  return (
    a.prompt === beat.prompt &&
    a.negative_prompt === beat.negative_prompt &&
    a.source_image_url === beat.source_image_url &&
    a.end_image_url === (beat.end_image_url || "") &&
    a.aspect === beat.aspect &&
    a.seconds === beat.seconds &&
    a.resolution === beat.resolution &&
    a.audio === beat.audio &&
    a.seed === beat.seed &&
    a.slow_mo === beat.slow_mo
  );
}

/** Empty queue → seed Beat 1 from the motion form. */
export function ensureBeat1(queue: BeatQueue, card: StudioMotionCard): BeatQueue {
  if (queue.beats.length > 0) return queue;
  return addBeat(queue, beatFromMotionCard(card));
}

/**
 * Form → Beat 1. Seeds when empty. Shallow-merge so trailing spaces
 * survive the next keystroke (same #132 rule as applyLocalBeatPatch).
 */
export function writeMotionCardToBeat1(queue: BeatQueue, card: StudioMotionCard): BeatQueue {
  const seeded = ensureBeat1(queue, card);
  return applyLocalBeatPatch(seeded, seeded.beats[0].id, motionFieldsFromCard(card));
}

export function motionCardFromBeat1(queue: BeatQueue): ReturnType<typeof emptyMotionCard> {
  const beat = queue.beats[0];
  if (!beat) return emptyMotionCard();
  return motionCardFromBeatLoose(beat);
}

/** Copy Beat 1 (or the selected beat) into a new draft — no clip / status. */
export function copyBeatAsNewDraft(beat: MotionBeat): MotionBeat {
  return emptyBeat({
    prompt: beat.prompt,
    negative_prompt: beat.negative_prompt,
    source_image_url: beat.source_image_url,
    end_image_url: beat.end_image_url,
    aspect: beat.aspect,
    seconds: beat.seconds,
    resolution: beat.resolution,
    audio: beat.audio,
    seed: beat.seed,
    slow_mo: beat.slow_mo,
    from_prev_last: false,
  });
}

/**
 * Beat 1's prompt lives on the main Motion form only.
 * Beats 2+ keep a filmstrip textarea + the selected-beat detail panel.
 */
export function beatPromptEditorForIndex(index: number): {
  mainForm: boolean;
  filmstripTextarea: boolean;
  detailPanel: boolean;
} {
  if (index === 0) {
    return { mainForm: true, filmstripTextarea: false, detailPanel: false };
  }
  return { mainForm: false, filmstripTextarea: true, detailPanel: true };
}
