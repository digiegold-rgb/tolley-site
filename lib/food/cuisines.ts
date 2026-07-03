export const CUISINE_OPTIONS: { slug: string; label: string; emoji: string }[] = [
  { slug: "american", label: "American", emoji: "🍔" },
  { slug: "italian", label: "Italian", emoji: "🍝" },
  { slug: "mexican", label: "Mexican", emoji: "🌮" },
  { slug: "chinese", label: "Chinese", emoji: "🥡" },
  { slug: "thai", label: "Thai", emoji: "🍜" },
  { slug: "indian", label: "Indian", emoji: "🍛" },
  { slug: "japanese", label: "Japanese", emoji: "🍣" },
  { slug: "mediterranean", label: "Mediterranean", emoji: "🥙" },
  { slug: "french", label: "French", emoji: "🥐" },
  { slug: "korean", label: "Korean", emoji: "🥢" },
  { slug: "middle-eastern", label: "Middle Eastern", emoji: "🧆" },
  { slug: "vietnamese", label: "Vietnamese", emoji: "🍲" },
  { slug: "greek", label: "Greek", emoji: "🫒" },
  { slug: "southern-bbq", label: "Southern / BBQ", emoji: "🍖" },
  { slug: "cajun-creole", label: "Cajun / Creole", emoji: "🦐" },
];

export const MIN_CUISINES = 3;
export const MAX_CUISINES = 7;

const SYNONYMS: Record<string, string> = {
  "american": "american",
  "italian": "italian",
  "mexican": "mexican",
  "tex-mex": "mexican",
  "chinese": "chinese",
  "asian": "chinese",
  "thai": "thai",
  "indian": "indian",
  "japanese": "japanese",
  "sushi": "japanese",
  "mediterranean": "mediterranean",
  "french": "french",
  "korean": "korean",
  "middle eastern": "middle-eastern",
  "middle-eastern": "middle-eastern",
  "vietnamese": "vietnamese",
  "greek": "greek",
  "southern": "southern-bbq",
  "bbq": "southern-bbq",
  "southern/bbq": "southern-bbq",
  "cajun": "cajun-creole",
  "creole": "cajun-creole",
};

export function normalizeCuisine(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return SYNONYMS[key] || key;
}

export function cuisineLabel(slug: string): string {
  return CUISINE_OPTIONS.find((c) => c.slug === slug)?.label || slug;
}
