/**
 * Editorial metadata for the curated voice clone library.
 *
 * Keyed by voice name. Voice names not present in this map are treated as
 * user-uploaded and render in a minimal fallback card (initials + audio).
 *
 * Avatars live under `/public/vater/voices/<name>.webp` (512×512, illustrated
 * — see scripts/vater-voice-portraits.py for the art direction and why these
 * are painted personas rather than photographs).
 * Reference WAVs are streamed through
 * `GET /api/vater/voices/[id]/sample` which proxies `autopilot.fetchVoiceFile`.
 *
 * ── Casting is measured, not guessed (2026-08-17) ──────────────────────────
 * Until now only 6 of the 17 shared voices had an entry here; the other 11
 * rendered as a grey tile with a letter in it. Rather than invent a persona
 * for a clone nobody had characterised, every `hz` below is the MEASURED
 * median speaking F0 of that voice's reference WAV (autocorrelation over
 * voiced frames). The measurement independently confirmed both existing
 * accuracy notes — AttenboroughUK reads at 163 Hz and YoungCasual at 192 Hz,
 * i.e. both are female readers despite male-sounding preset names.
 *
 * `bestFor` is drawn from each clone's own reference script, not imagined:
 * the finance-behaviour read, the bin-store haul read, and the KC listings
 * read each cast a clear lane.
 */
export interface VoicePresetMeta {
  name: string;
  /** Friendly display label shown in the UI (may differ from the raw filename stem). */
  displayName: string;
  emoji: string;
  /** "Young casual American male" / "Deep older British female" etc. */
  character: string;
  /** 1-2 sentence description of how the voice sounds. */
  description: string;
  /** Use-case tagline. */
  bestFor: string;
  /** Public path to the portrait avatar. */
  avatarUrl: string;
  /**
   * Measured median speaking pitch in Hz. Drives the "Deep / Mid / Bright"
   * register chip so the picker can be sorted and scanned by ear-shape
   * instead of by name.
   */
  hz: number;
  /** Optional disclaimer — e.g. label is misleading. */
  accuracyNote?: string;
}

/** Register bands for the picker chip. Boundaries are conventional speaking-F0 splits. */
export type VoiceRegister = "Deep" | "Low" | "Mid" | "Bright";

export function registerFor(hz: number): VoiceRegister {
  if (hz < 120) return "Deep";
  if (hz < 170) return "Low";
  if (hz < 240) return "Mid";
  return "Bright";
}

export const VOICE_CATALOG: Record<string, VoicePresetMeta> = {
  /* ── Deep ─────────────────────────────────────────────────────────── */
  Wallace: {
    name: "Wallace",
    displayName: "Wallace",
    emoji: "🛡️",
    character: "Deepest male in the library",
    description: "Resonant, weighty, unhurried. Fills a room without raising.",
    bestFor: "Documentary narration, trailers, gravitas-first storytelling",
    avatarUrl: "/vater/voices/Wallace.webp",
    hz: 98,
  },
  Cash: {
    name: "Cash",
    displayName: "Cash",
    emoji: "🤠",
    character: "Low, easy, lived-in male",
    description: "Gravelly and relaxed with a wry edge. Sounds like experience.",
    bestFor: "Reselling and haul videos, plain-spoken deal breakdowns",
    avatarUrl: "/vater/voices/Cash.webp",
    hz: 102,
  },
  Monroe: {
    name: "Monroe",
    displayName: "Monroe",
    emoji: "📈",
    character: "Composed authoritative male",
    description: "Level, deliberate, credible. Lands a hard number without drama.",
    bestFor: "Finance explainers, investing behaviour, money mindset",
    avatarUrl: "/vater/voices/Monroe.webp",
    hz: 106,
  },
  MorganDeep: {
    name: "MorganDeep",
    displayName: "Morgan Deep",
    emoji: "🌊",
    character: "Deep authoritative older male",
    description: "Slow careful cadence, warm baritone, library-study tone.",
    bestFor: "Finance, documentaries, serious storytelling",
    avatarUrl: "/vater/voices/MorganDeep.webp",
    hz: 112,
  },

  /* ── Low ──────────────────────────────────────────────────────────── */
  NewsClear: {
    name: "NewsClear",
    displayName: "News Clear",
    emoji: "📰",
    character: "Poised American newsreader",
    description: "Crisp, punchy, professional. Every word lands.",
    bestFor: "News-style videos, breaking takes, headline commentary",
    avatarUrl: "/vater/voices/NewsClear.webp",
    hz: 128,
  },
  Narrator: {
    name: "Narrator",
    displayName: "Narrator",
    emoji: "🎙️",
    character: "Young casual American male",
    description:
      "Friendly, conversational, millennial. Relaxed cadence, easy to listen to.",
    bestFor: "Social media, casual explainers, vlog-style content",
    avatarUrl: "/vater/voices/Narrator.webp",
    hz: 142,
  },
  Nova: {
    name: "Nova",
    displayName: "Nova",
    emoji: "✨",
    character: "Bright, clear younger male",
    description: "Upbeat and articulate with forward energy. Easy to follow at speed.",
    bestFor: "Product walkthroughs, haul videos, fast-paced explainers",
    avatarUrl: "/vater/voices/Nova.webp",
    hz: 152,
  },
  AttenboroughUK: {
    name: "AttenboroughUK",
    displayName: "Attenborough UK",
    emoji: "🇬🇧",
    character: "Distinguished older British voice",
    description:
      "Thoughtful educational delivery with a documentary feel.",
    bestFor: "Educational explainers, science content, cultural topics",
    avatarUrl: "/vater/voices/AttenboroughUK.webp",
    hz: 163,
    accuracyNote:
      "Voice is actually Ruth Golding (British female), not male. Same documentary tone.",
  },
  Eric: {
    name: "Eric",
    displayName: "Eric",
    emoji: "🏡",
    character: "Approachable everyday male",
    description: "Even, neighbourly, unfussy. Reads a list without sounding like a list.",
    bestFor: "Real-estate tours, local roundups, listing walkthroughs",
    avatarUrl: "/vater/voices/Eric.webp",
    hz: 164,
  },

  /* ── Mid ──────────────────────────────────────────────────────────── */
  Jessica: {
    name: "Jessica",
    displayName: "Jessica",
    emoji: "💬",
    character: "Warm conversational female",
    description: "Natural and engaged, like she's telling you across a kitchen table.",
    bestFor: "Home and lifestyle finds, deal stories, everyday how-tos",
    avatarUrl: "/vater/voices/Jessica.webp",
    hz: 191,
  },
  YoungCasual: {
    name: "YoungCasual",
    displayName: "Young Casual",
    emoji: "☕",
    character: "Conversational young woman",
    description: "Light, casual, friendly. Like a cafe-chat explainer.",
    bestFor: "Lifestyle, social media reels, casual hot-takes",
    avatarUrl: "/vater/voices/YoungCasual.webp",
    hz: 192,
    accuracyNote:
      "Voice is actually a female Pride and Prejudice reader, not the millennial male the label suggests.",
  },
  CalmFemale: {
    name: "CalmFemale",
    displayName: "Calm Female",
    emoji: "🧘",
    character: "Soft-spoken female",
    description: "Gentle, measured, warm. Feels like a meditation app.",
    bestFor: "Wellness, mindfulness, calm educational content",
    avatarUrl: "/vater/voices/CalmFemale.webp",
    hz: 194,
  },
  Sterling: {
    name: "Sterling",
    displayName: "Sterling",
    emoji: "💼",
    character: "Polished professional female",
    description: "Composed and precise with quiet authority. Boardroom-clear.",
    bestFor: "Business explainers, finance breakdowns, brand narration",
    avatarUrl: "/vater/voices/Sterling.webp",
    hz: 211,
  },
  Junie: {
    name: "Junie",
    displayName: "Junie",
    emoji: "🌻",
    character: "Cheerful storytelling female",
    description: "Animated and expressive with real momentum. Keeps a story moving.",
    bestFor: "Haul and thrift videos, personal stories, vlog narration",
    avatarUrl: "/vater/voices/Junie.webp",
    hz: 233,
  },

  /* ── Bright ───────────────────────────────────────────────────────── */
  Beckett: {
    name: "Beckett",
    displayName: "Beckett",
    emoji: "⚡",
    character: "Quick, bright female",
    description: "Sharp and articulate with a high clear ring. Sounds switched-on.",
    bestFor: "Finance hot-takes, myth-busting, punchy explainers",
    avatarUrl: "/vater/voices/Beckett.webp",
    hz: 270,
  },
  Rae: {
    name: "Rae",
    displayName: "Rae",
    emoji: "🎈",
    character: "Warm enthusiastic female",
    description: "Sunny and high-energy without tipping into shrill.",
    bestFor: "Reels, unboxings, upbeat lifestyle content",
    avatarUrl: "/vater/voices/Rae.webp",
    hz: 289,
  },
  Birdie: {
    name: "Birdie",
    displayName: "Birdie",
    emoji: "🐦",
    character: "Youthful, playful female",
    description: "The brightest read in the library — light, quick and buoyant.",
    bestFor: "Short-form hooks, kids and family content, playful narration",
    avatarUrl: "/vater/voices/Birdie.webp",
    hz: 343,
  },
};

export function getVoiceMeta(name: string): VoicePresetMeta | null {
  return VOICE_CATALOG[name] ?? null;
}
