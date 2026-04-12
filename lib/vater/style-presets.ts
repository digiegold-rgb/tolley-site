/**
 * The 14 visual style presets for the VATER YouTube pipeline.
 *
 * 8 original (cinematic, comic_book, anime, pixel_art, pixar, digital_art,
 * watercolor, low_poly) plus 6 cartoon/anime variants added 2026-04-11
 * at user request:
 *   - classic_cartoon (Hanna-Barbera Saturday-morning)
 *   - chibi_kawaii (cute Japanese chibi)
 *   - shonen_action (Dragon Ball Z / Naruto action anime)
 *   - slice_of_life (Makoto Shinkai "Your Name" aesthetic)
 *   - flat_modern (Duolingo/Airbnb flat vector)
 *   - storybook (Quentin Blake children's book)
 *
 * IDs MUST match the DGX side exactly — they are forwarded as-is in
 * `runCreation({ stylePreset })` and used by `vater.py` to look up the
 * SDXL prompt prefix that ComfyUI uses for scene generation.
 *
 * `promptPrefix` here is informational/debug only — the canonical copy
 * lives in `/home/jelly/content-autopilot/vater.py`. Keep them in sync.
 *
 * `sampleImageUrl` points to a pre-rendered SDXL Lightning sample under
 * `/public/vater/styles/<id>.webp` (768×432 webp) so the preview cards in
 * `<YouTubeStylePicker>` can show exactly what each style looks like
 * before the user commits to rendering a 15-minute job.
 */
export interface StylePreset {
  id: string;
  name: string;
  emoji: string;
  promptPrefix: string;
  /** "What it looks like" — one-sentence visual description. */
  description: string;
  /** "Best for" — one-line use-case tagline. */
  bestFor: string;
  /** Public path to the preview sample image. */
  sampleImageUrl: string;
}

export const STYLE_PRESETS: readonly StylePreset[] = [
  {
    id: "cinematic",
    name: "Cinematic",
    emoji: "📷",
    promptPrefix:
      "cinematic photograph, dramatic lighting, shallow depth of field, 8k",
    description:
      "Cinematic photograph, dramatic lighting, shallow DoF, 8k",
    bestFor:
      "Serious real estate, finance, news-style content, documentaries. Default for most videos.",
    sampleImageUrl: "/vater/styles/cinematic.webp",
  },
  {
    id: "comic_book",
    name: "Comic Book",
    emoji: "💥",
    promptPrefix:
      "comic book panel, bold lines, halftone shading, dynamic composition",
    description:
      "Comic book panel, bold lines, halftone shading, dynamic composition",
    bestFor: "Action-heavy stories, punchy commentary, viral takes",
    sampleImageUrl: "/vater/styles/comic_book.webp",
  },
  {
    id: "anime",
    name: "Anime",
    emoji: "🎌",
    promptPrefix:
      "anime illustration, Studio Ghibli style, vibrant colors, detailed background",
    description:
      "Anime illustration, Studio Ghibli style, vibrant colors, detailed background",
    bestFor: "Story-driven content, lifestyle, travel, anything emotional",
    sampleImageUrl: "/vater/styles/anime.webp",
  },
  {
    id: "pixel_art",
    name: "Pixel Art",
    emoji: "🎮",
    promptPrefix: "16-bit pixel art, retro game aesthetic, limited palette",
    description: "16-bit pixel art, retro game aesthetic, limited palette",
    bestFor: "Gaming content, nostalgia, tech throwbacks",
    sampleImageUrl: "/vater/styles/pixel_art.webp",
  },
  {
    id: "pixar",
    name: "Pixar 3D",
    emoji: "🎨",
    promptPrefix:
      "Pixar 3D render, soft lighting, expressive, children film aesthetic",
    description:
      "Pixar 3D render, soft lighting, expressive, children's film aesthetic",
    bestFor: "Educational content, family-friendly, warm tone",
    sampleImageUrl: "/vater/styles/pixar.webp",
  },
  {
    id: "digital_art",
    name: "Digital Art",
    emoji: "🖌️",
    promptPrefix: "digital painting, ArtStation trending, detailed, matte",
    description: "Digital painting, ArtStation trending, detailed, matte",
    bestFor: "Sci-fi, fantasy, hot-take commentary, dramatic reveals",
    sampleImageUrl: "/vater/styles/digital_art.webp",
  },
  {
    id: "watercolor",
    name: "Watercolor",
    emoji: "🎨",
    promptPrefix:
      "watercolor illustration, soft edges, paper texture, loose brushwork",
    description:
      "Watercolor illustration, soft edges, paper texture, loose brushwork",
    bestFor: "Calm educational, wellness, travel, art content",
    sampleImageUrl: "/vater/styles/watercolor.webp",
  },
  {
    id: "low_poly",
    name: "Low Poly",
    emoji: "🔷",
    promptPrefix: "low poly 3D, flat shading, geometric, minimalist",
    description: "Low poly 3D, flat shading, geometric, minimalist",
    bestFor: "Tech/product explainers, data viz, modern startup vibe",
    sampleImageUrl: "/vater/styles/low_poly.webp",
  },
  // ── 6 cartoon/anime additions (2026-04-11) ─────────────────────────
  {
    id: "classic_cartoon",
    name: "Classic Cartoon",
    emoji: "🌈",
    promptPrefix:
      "classic Saturday-morning cartoon illustration, bold black outlines, bright flat colors, cel-shaded, Hanna-Barbera aesthetic, cheerful",
    description:
      "Bright Saturday-morning cartoon with bold outlines, flat colors, Hanna-Barbera energy",
    bestFor:
      "Kids content, family videos, funny takes, nostalgic cartoon vibes",
    sampleImageUrl: "/vater/styles/classic_cartoon.webp",
  },
  {
    id: "chibi_kawaii",
    name: "Chibi Kawaii",
    emoji: "🎀",
    promptPrefix:
      "chibi kawaii illustration, big expressive eyes, pastel colors, soft shading, cute Japanese anime chibi style, adorable",
    description:
      "Cute chibi with big expressive eyes, soft pastels, adorable Japanese style",
    bestFor:
      "Lifestyle, positivity content, wellness, anything cute or playful",
    sampleImageUrl: "/vater/styles/chibi_kawaii.webp",
  },
  {
    id: "shonen_action",
    name: "Shonen Action",
    emoji: "⚡",
    promptPrefix:
      "shonen anime action scene, dynamic composition, speed lines, vibrant colors, manga ink style, high energy, Dragon Ball Z Naruto feel",
    description:
      "High-energy shonen anime with speed lines, vibrant colors, dynamic composition",
    bestFor:
      "Sports, motivation, high-energy reveals, hype videos, workouts",
    sampleImageUrl: "/vater/styles/shonen_action.webp",
  },
  {
    id: "slice_of_life",
    name: "Slice of Life",
    emoji: "🌸",
    promptPrefix:
      "slice of life anime, Makoto Shinkai Your Name aesthetic, soft dreamy colors, beautiful backgrounds, cinematic lighting, emotional",
    description:
      "Dreamy Makoto Shinkai aesthetic with soft colors and cinematic emotional backgrounds",
    bestFor:
      "Emotional stories, travel, reflection, personal essays, storytelling",
    sampleImageUrl: "/vater/styles/slice_of_life.webp",
  },
  {
    id: "flat_modern",
    name: "Flat Modern",
    emoji: "🔶",
    promptPrefix:
      "modern flat vector illustration, geometric shapes, bold pastel palette, corporate Memphis style, minimalist, Duolingo Airbnb aesthetic",
    description:
      "Flat vector illustration, geometric shapes, bold pastels — Duolingo/Airbnb vibe",
    bestFor:
      "Tech explainers, how-tos, modern startup content, SaaS demos",
    sampleImageUrl: "/vater/styles/flat_modern.webp",
  },
  {
    id: "storybook",
    name: "Storybook",
    emoji: "📖",
    promptPrefix:
      "children's storybook illustration, Quentin Blake style, hand-drawn ink lines, watercolor wash, warm playful, Oliver Jeffers aesthetic",
    description:
      "Hand-drawn ink and watercolor children's book style — Quentin Blake warmth",
    bestFor:
      "Educational for kids, warm explainers, family content, nostalgic storytelling",
    sampleImageUrl: "/vater/styles/storybook.webp",
  },
] as const;

export type StylePresetId = (typeof STYLE_PRESETS)[number]["id"];

export const DEFAULT_STYLE_PRESET: StylePresetId = "cinematic";

export function isStylePresetId(value: unknown): value is StylePresetId {
  return (
    typeof value === "string" && STYLE_PRESETS.some((p) => p.id === value)
  );
}

export function getStylePreset(id: string): StylePreset | undefined {
  return STYLE_PRESETS.find((p) => p.id === id);
}
