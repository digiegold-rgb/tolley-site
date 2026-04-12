/**
 * Editorial metadata for the curated voice clone library.
 *
 * Keyed by voice name. Voice names not present in this map are treated as
 * user-uploaded and render in a minimal fallback card (initials + audio).
 *
 * Avatars live under `/public/vater/voices/<name>.webp` (256×256).
 * Reference WAVs are streamed through
 * `GET /api/vater/voices/[id]/sample` which proxies `autopilot.fetchVoiceFile`.
 */
export interface VoicePresetMeta {
  name: string;
  emoji: string;
  /** "Young casual American male" / "Deep older British female" etc. */
  character: string;
  /** 1-2 sentence description of how the voice sounds. */
  description: string;
  /** Use-case tagline. */
  bestFor: string;
  /** Public path to the portrait avatar. */
  avatarUrl: string;
  /** Optional disclaimer — e.g. label is misleading. */
  accuracyNote?: string;
}

export const VOICE_CATALOG: Record<string, VoicePresetMeta> = {
  Narrator: {
    name: "Narrator",
    emoji: "🎙️",
    character: "Young casual American male",
    description:
      "Friendly, conversational, millennial. Relaxed cadence, easy to listen to.",
    bestFor: "Social media, casual explainers, vlog-style content",
    avatarUrl: "/vater/voices/Narrator.webp",
  },
  MorganDeep: {
    name: "MorganDeep",
    emoji: "🌊",
    character: "Deep authoritative older male",
    description:
      "Slow careful cadence, warm baritone, library-study tone.",
    bestFor: "Finance, documentaries, serious storytelling",
    avatarUrl: "/vater/voices/MorganDeep.webp",
  },
  AttenboroughUK: {
    name: "AttenboroughUK",
    emoji: "🇬🇧",
    character: "Distinguished older British voice",
    description:
      "Thoughtful educational delivery with a documentary feel.",
    bestFor: "Educational explainers, science content, cultural topics",
    avatarUrl: "/vater/voices/AttenboroughUK.webp",
    accuracyNote:
      "Voice is actually Ruth Golding (British female), not male. Same documentary tone.",
  },
  NewsClear: {
    name: "NewsClear",
    emoji: "📰",
    character: "Poised American newsreader",
    description: "Crisp, punchy, professional. Every word lands.",
    bestFor: "News-style videos, breaking takes, headline commentary",
    avatarUrl: "/vater/voices/NewsClear.webp",
  },
  CalmFemale: {
    name: "CalmFemale",
    emoji: "🧘",
    character: "Soft-spoken female",
    description: "Gentle, measured, warm. Feels like a meditation app.",
    bestFor: "Wellness, mindfulness, calm educational content",
    avatarUrl: "/vater/voices/CalmFemale.webp",
  },
  YoungCasual: {
    name: "YoungCasual",
    emoji: "☕",
    character: "Conversational young woman",
    description: "Light, casual, friendly. Like a cafe-chat explainer.",
    bestFor: "Lifestyle, social media reels, casual hot-takes",
    avatarUrl: "/vater/voices/YoungCasual.webp",
    accuracyNote:
      "Voice is actually a female Pride and Prejudice reader, not the millennial male the label suggests.",
  },
  Sample: {
    name: "Sample",
    emoji: "⚠️",
    character: "Placeholder — do not use",
    description:
      "1 second of silence from the original Task 1 placeholder. F5-TTS cannot clone from this.",
    bestFor: "Nothing — pick any other voice",
    avatarUrl: "/vater/voices/Sample.webp",
    accuracyNote: "BROKEN placeholder. Pick any other voice.",
  },
};

export function getVoiceMeta(name: string): VoicePresetMeta | null {
  return VOICE_CATALOG[name] ?? null;
}
