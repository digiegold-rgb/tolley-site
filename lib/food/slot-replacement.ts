import { prisma } from "@/lib/prisma";
import {
  chooseTopRecipe,
  chooseTopN,
  type ScoreContext,
} from "./recipe-scorer";
import { normalizeCuisine } from "./cuisines";

interface ReplaceArgs {
  householdId: string;
  planId: string;
  weekStart: Date;
  mealType: string;
  currentRecipeId: string | null;
  members: { role: string; ageRange: string | null; dislikes: string[] }[];
  cuisinePrefs: string[];
  excludeIds: string[];
  takeN: number;
}

function mealTypeFilter(mt: string) {
  if (mt === "lunch") return { OR: [{ mealType: { has: "lunch" } }, { mealType: { has: "dinner" } }] };
  if (mt === "snack") return { OR: [{ mealType: { has: "snack" } }, { mealType: { has: "dessert" } }] };
  return { mealType: { has: mt } };
}

export async function chooseReplacement(args: ReplaceArgs) {
  const pool = await prisma.foodRecipe.findMany({
    where: {
      householdId: args.householdId,
      ...mealTypeFilter(args.mealType),
    },
    orderBy: { rating: "desc" },
  });

  if (pool.length === 0) return [];

  const otherSlots = await prisma.foodMealSlot.findMany({
    where: { planId: args.planId },
    select: { recipeId: true },
  });
  const usedThisWeek = new Set<string>();
  for (const s of otherSlots) {
    if (s.recipeId) usedThisWeek.add(s.recipeId);
  }

  const excluded = new Set<string>(args.excludeIds);
  if (args.currentRecipeId) excluded.add(args.currentRecipeId);

  const fourWeeksAgo = new Date(args.weekStart);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const recentPlans = await prisma.foodMealPlan.findMany({
    where: {
      householdId: args.householdId,
      weekStart: { gte: fourWeeksAgo, lt: args.weekStart },
    },
    include: { slots: { select: { recipeId: true } } },
  });
  const recentFreq = new Map<string, number>();
  for (const p of recentPlans) {
    for (const s of p.slots) {
      if (s.recipeId) recentFreq.set(s.recipeId, (recentFreq.get(s.recipeId) || 0) + 1);
    }
  }

  const hasKids = args.members.some(
    (m) => m.role === "kid" || m.ageRange === "kid" || m.ageRange === "toddler" || m.ageRange === "teen"
  );

  const dislikes = new Set<string>();
  for (const m of args.members) {
    for (const d of m.dislikes || []) {
      const t = d.trim().toLowerCase();
      if (t) dislikes.add(t);
    }
  }

  const weekCuisines: string[] = [];
  for (const s of otherSlots) {
    if (!s.recipeId) continue;
    const r = pool.find((x) => x.id === s.recipeId);
    const c = normalizeCuisine(r?.cuisine);
    if (c) weekCuisines.push(c);
  }

  const ctx: ScoreContext = {
    kidFriendly: hasKids,
    newCuisine: true,
    cuisinePreferences: (args.cuisinePrefs || []).map((c) => c.toLowerCase()),
    usedThisWeek,
    weekCuisines,
    recentFreq,
    excludedIds: excluded,
    dislikes,
  };

  if (args.takeN === 1) {
    const top = chooseTopRecipe(pool, ctx);
    return top ? [top] : [];
  }

  return chooseTopN(pool, ctx, args.takeN);
}
