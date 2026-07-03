import { normalizeCuisine } from "./cuisines";

export interface ScorableRecipe {
  id: string;
  rating: number | null;
  cuisine: string | null;
  tags: string[];
  prepTime: number | null;
  cookTime: number | null;
  mealType: string[];
}

export interface ScoreContext {
  kidFriendly: boolean;
  newCuisine: boolean;
  cuisinePreferences: string[];
  usedThisWeek: Set<string>;
  weekCuisines: string[];
  recentFreq: Map<string, number>;
  excludedIds?: Set<string>;
  dislikes?: Set<string>;
}

export function scoreRecipe(r: ScorableRecipe, ctx: ScoreContext): number {
  if (ctx.excludedIds?.has(r.id)) return -Infinity;

  let s = Math.random() * 20;

  if (ctx.usedThisWeek.has(r.id)) s -= 200;
  s -= (ctx.recentFreq.get(r.id) || 0) * 25;
  s += (r.rating || 3) * 5;

  if (ctx.kidFriendly && r.tags.includes("kid-friendly")) s += 12;

  // Cuisine preference (primary signal)
  const normalized = normalizeCuisine(r.cuisine);
  if (ctx.cuisinePreferences.length > 0 && normalized) {
    if (ctx.cuisinePreferences.includes(normalized)) s += 25;
    else s -= 8;
  }

  // Within-week variety: encourage cuisines not yet used this week
  if (ctx.newCuisine && normalized && !ctx.weekCuisines.includes(normalized)) {
    s += 15;
  }

  // Quick-meal boost
  if ((r.prepTime || 0) + (r.cookTime || 0) <= 30) s += 3;

  // Dislikes penalty (family member free-text)
  if (ctx.dislikes && ctx.dislikes.size > 0) {
    const hay = `${r.tags.join(" ")} ${r.cuisine || ""}`.toLowerCase();
    for (const d of ctx.dislikes) {
      if (d && hay.includes(d)) s -= 25;
    }
  }

  return s;
}

export function chooseTopRecipe<T extends ScorableRecipe>(pool: T[], ctx: ScoreContext): T | null {
  if (pool.length === 0) return null;
  const scored = pool.map((r) => ({ r, s: scoreRecipe(r, ctx) }));
  scored.sort((a, b) => b.s - a.s);
  const top = scored[0];
  return top && top.s > -Infinity ? top.r : null;
}

export function chooseTopN<T extends ScorableRecipe>(pool: T[], ctx: ScoreContext, n: number): T[] {
  if (pool.length === 0) return [];
  const scored = pool.map((r) => ({ r, s: scoreRecipe(r, ctx) }));
  scored.sort((a, b) => b.s - a.s);
  return scored
    .filter((x) => x.s > -Infinity)
    .slice(0, n)
    .map((x) => x.r);
}
