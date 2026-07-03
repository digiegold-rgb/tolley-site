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
 * Pull the gender token from a character descriptor's first sentence.
 * Descriptors are required to open with "A 2D cartoon [male|female|
 * androgynous] character …" by the system prompt at vater.py:6029. We
 * scan the first 200 chars to be tolerant of minor LLM variation.
 */
function parseGenderFromDescriptor(desc: string): string {
  const head = desc.slice(0, 200).toLowerCase();
  if (/\bandrogynous\b/.test(head)) return "androgynous";
  if (/\bmale\b/.test(head) && !/\bfemale\b/.test(head)) return "male";
  if (/\bfemale\b/.test(head) || /\b(woman|girl|lady)\b/.test(head)) return "female";
  if (/\b(man|boy|gentleman)\b/.test(head)) return "male";
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

function asVoiceBackend(value: string): "f5-tts" | "elevenlabs" {
  return value === "elevenlabs" ? "elevenlabs" : "f5-tts";
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
    characters: style.characters.map((c) => ({
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
