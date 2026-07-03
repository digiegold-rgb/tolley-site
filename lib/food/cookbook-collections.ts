export interface CookbookRecipe {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string | null;
  cuisine?: string | null;
  mealType: string[];
  prepTime?: number | null;
  cookTime?: number | null;
  rating?: number | null;
  tags: string[];
  timesCooked: number;
}

export interface CookbookCollection {
  id: string;
  title: string;
  emoji: string;
  filter: (r: CookbookRecipe) => boolean;
  sort?: (a: CookbookRecipe, b: CookbookRecipe) => number;
  cap?: number;
}

const totalTime = (r: CookbookRecipe) => (r.prepTime || 0) + (r.cookTime || 0);

export const COOKBOOK_COLLECTIONS: CookbookCollection[] = [
  {
    id: "family-favorites",
    title: "Family Favorites",
    emoji: "💕",
    filter: (r) => (r.rating || 0) >= 4,
  },
  {
    id: "most-cooked",
    title: "Most Cooked",
    emoji: "🔥",
    filter: (r) => r.timesCooked > 0,
    sort: (a, b) => b.timesCooked - a.timesCooked,
    cap: 10,
  },
  {
    id: "quick-easy",
    title: "Quick & Easy (Under 30 Min)",
    emoji: "⚡",
    filter: (r) => {
      const t = totalTime(r);
      return t > 0 && t <= 30;
    },
  },
  {
    id: "kid-approved",
    title: "Kid Approved",
    emoji: "👶",
    filter: (r) => r.tags.includes("kid-friendly"),
  },
  {
    id: "american-kitchen",
    title: "American Kitchen",
    emoji: "🇺🇸",
    filter: (r) => r.cuisine === "American",
  },
  {
    id: "mexican-kitchen",
    title: "Mexican Kitchen",
    emoji: "🌮",
    filter: (r) => r.cuisine === "Mexican",
  },
  {
    id: "italian-kitchen",
    title: "Italian Kitchen",
    emoji: "🍝",
    filter: (r) => r.cuisine === "Italian",
  },
  {
    id: "asian-kitchen",
    title: "Asian Kitchen",
    emoji: "🥢",
    filter: (r) => r.cuisine === "Asian",
  },
  {
    id: "southern-kitchen",
    title: "Southern Kitchen",
    emoji: "🍗",
    filter: (r) => r.cuisine === "Southern",
  },
  {
    id: "mediterranean-kitchen",
    title: "Mediterranean Kitchen",
    emoji: "🫒",
    filter: (r) => r.cuisine === "Mediterranean",
  },
  {
    id: "comfort-food",
    title: "Comfort Food",
    emoji: "🛋️",
    filter: (r) => r.tags.includes("comfort"),
  },
  {
    id: "breakfast-brunch",
    title: "Breakfast & Brunch",
    emoji: "🥞",
    filter: (r) => r.mealType.includes("breakfast"),
  },
  {
    id: "set-forget",
    title: "Set It & Forget It",
    emoji: "🫕",
    filter: (r) => r.tags.includes("slow-cooker") || (r.cookTime || 0) >= 120,
  },
  {
    id: "healthy-light",
    title: "Healthy & Light",
    emoji: "🥗",
    filter: (r) =>
      r.tags.includes("healthy") ||
      r.tags.includes("light") ||
      r.tags.includes("fresh"),
  },
];

export function getCollectionRecipes(
  collection: CookbookCollection,
  recipes: CookbookRecipe[],
): CookbookRecipe[] {
  let out = recipes.filter(collection.filter);
  if (collection.sort) out = [...out].sort(collection.sort);
  if (collection.cap) out = out.slice(0, collection.cap);
  return out;
}

export function findCollection(id: string): CookbookCollection | undefined {
  return COOKBOOK_COLLECTIONS.find((c) => c.id === id);
}
