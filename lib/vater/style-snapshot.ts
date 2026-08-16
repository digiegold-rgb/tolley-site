/**
 * Serializes a YouTubeStyle (with characters + customArtStyle eagerly
 * loaded) into a StyleSnapshot for the runCreation payload. The DGX
 * worker treats this as the source of truth — never calls back to the
 * portal for style data.
 *
 * Snapshot semantics: this is a point-in-time copy. Editing the Style
 * later does NOT retroactively change a rendered project — matches
 * TubeGen's own pattern (see /tmp/tubegen-research/api-dumps/full-project-intel.md).
 */
import "server-only";
import type {
  YouTubeStyle,
  YouTubeCharacter,
  CustomArtStyle,
} from "@prisma/client";
import type { StyleSnapshot } from "./autopilot-client";

type StyleWithRelations = YouTubeStyle & {
  characters: YouTubeCharacter[];
  customArtStyle: CustomArtStyle | null;
};

/**
 * Pull the gender token from a character descriptor's first sentences.
 * Descriptors are *supposed* to open with "A 2D cartoon [male|female|
 * androgynous] character …" (vater.py's casting prompt), but hand-authored
 * and legacy descriptors routinely don't — Jeff Whitfield's opens
 * "middle-aged, with warm peachy-tan skin. He has …", which matched none of
 * the old noun patterns and fell through to the "female" default. vater.py
 * turns this into a hard prompt prefix ("A 2D cartoon female character."), so
 * a wrong read fights the descriptor in every single scene image.
 *
 * PRONOUNS are the reliable signal in these descriptors, so they count.
 * Word boundaries keep "woman" from matching \bman\b and "She" from matching
 * \bhe\b; when a descriptor carries both (e.g. a comparison to a spouse), the
 * FIRST gendered token wins, since descriptors lead with their own subject.
 */
const FEMALE_TOKENS = /\bfemale\b|\b(?:woman|girl|lady|she|her|hers)\b/;
const MALE_TOKENS = /\bmale\b|\b(?:man|boy|gentleman|he|his|him)\b/;
const ANY_GENDER_TOKEN =
  /\b(female|woman|girl|lady|she|her|hers|male|man|boy|gentleman|he|his|him)\b/;

function parseGenderFromDescriptor(desc: string): string {
  const head = desc.slice(0, 300).toLowerCase();
  if (/\bandrogynous\b/.test(head)) return "androgynous";
  const female = FEMALE_TOKENS.test(head);
  const male = MALE_TOKENS.test(head);
  if (female !== male) return female ? "female" : "male";
  const first = head.match(ANY_GENDER_TOKEN);
  if (first) {
    return FEMALE_TOKENS.test(first[1]) ? "female" : "male";
  }
  return "female";
}

type RefTranscript = {
  videoId?: string;
  url: string;
  title: string;
  wordCount: number;
  transcript: string;
};

function asRefTranscripts(value: unknown): RefTranscript[] {
  if (!Array.isArray(value)) return [];
  const out: RefTranscript[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.url !== "string" || typeof e.title !== "string") continue;
    if (typeof e.transcript !== "string") continue;
    out.push({
      videoId: typeof e.videoId === "string" ? e.videoId : undefined,
      url: e.url,
      title: e.title,
      wordCount: typeof e.wordCount === "number" ? e.wordCount : 0,
      transcript: e.transcript,
    });
  }
  return out;
}

function asVoiceBackend(
  value: string,
): "f5-tts" | "elevenlabs" | "indextts-modal" {
  if (value === "elevenlabs") return "elevenlabs";
  // "indextts-modal" = IndexTTS-2 on Modal (cloud). Everything else falls
  // back to the legacy local F5-TTS lane, which is owner-only in practice.
  if (value === "indextts-modal") return "indextts-modal";
  return "f5-tts";
}

export function buildStyleSnapshot(style: StyleWithRelations): StyleSnapshot {
  return {
    id: style.id,
    name: style.name,
    voice: style.voice,
    voiceBackend: asVoiceBackend(style.voiceBackend),
    voiceSpeed: style.voiceSpeed,
    voiceStability: style.voiceStability,
    voiceSimilarity: style.voiceSimilarity,
    voiceExaggeration: style.voiceExaggeration,
    language: style.language,
    defaultWordCount: style.defaultWordCount,
    scriptMode: style.scriptMode,
    webSearchDefault: style.webSearchDefault,
    additionalContext: style.additionalContext,
    referenceTranscripts: asRefTranscripts(style.referenceTranscripts),
    artStylePresetId: style.artStylePresetId,
    defaultAspectRatio: style.defaultAspectRatio,
    defaultQuality: style.defaultQuality,
    defaultVisualType: style.defaultVisualType,
    defaultAnimMode: style.defaultAnimMode,
    defaultAnimMin: style.defaultAnimMin,
    defaultAnimMax: style.defaultAnimMax,
    defaultPacingSec: style.defaultPacingSec,
    defaultConsistency: style.defaultConsistency,
    enableCharts: style.enableCharts,
    enableMaps: style.enableMaps,
    enableAutoHeaders: style.enableAutoHeaders,
    overlayTheme: style.overlayTheme,
    customArtStyle: style.customArtStyle
      ? {
          id: style.customArtStyle.id,
          name: style.customArtStyle.name,
          description: style.customArtStyle.description,
          referenceImageUrls: style.customArtStyle.referenceImageUrls,
        }
      : null,
    // Order is load-bearing, not cosmetic: vater.py treats characters[0] as
    // the show's HOST and force-injects that identity. Prisma's
    // `include: { characters: true }` has no ORDER BY, so without this the
    // host could silently become whichever row Postgres happened to return
    // first — e.g. Linda hosting a video instead of Jeff. Oldest-first makes
    // the founding character the host on every style.
    characters: [...style.characters]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        imageUrl: c.imageUrl,
        permanent: c.permanent,
        placeInEveryImage: c.placeInEveryImage,
        // Gender parsed at runtime from the descriptor's first sentence.
        // Once the optional `gender` DB column is migrated, replace with c.gender.
        gender: parseGenderFromDescriptor(c.description),
      })),
  };
}
