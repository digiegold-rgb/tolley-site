// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Creative "Try Something New" meal ideas — injected once a week
const CREATIVE_IDEAS = [
  { title: "Homemade Ramen Night", desc: "Build-your-own ramen bowls with soft eggs, noodles, and toppings", cuisine: "Asian" },
  { title: "Taco Bar Tuesday", desc: "Set up a taco station with 3 proteins and all the toppings", cuisine: "Mexican" },
  { title: "Breakfast for Dinner", desc: "Pancakes, bacon, scrambled eggs at dinnertime!", cuisine: "American" },
  { title: "Homemade Pizza Night", desc: "Everyone makes their own pizza with dough and toppings", cuisine: "Italian" },
  { title: "Korean BBQ at Home", desc: "Grill bulgogi with rice, kimchi, and pickled veggies", cuisine: "Asian" },
  { title: "Soup & Sandwich Saturday", desc: "Pick a hearty soup and pair with grilled sandwiches", cuisine: "American" },
  { title: "Mediterranean Mezze Platter", desc: "Hummus, pita, falafel, tabbouleh, olives", cuisine: "Mediterranean" },
  { title: "Stir-Fry Freestyle", desc: "Clean out the fridge stir-fry with whatever veggies you have", cuisine: "Asian" },
  { title: "Crockpot Challenge", desc: "Throw it all in the slow cooker in the morning, feast at dinner", cuisine: "American" },
  { title: "Pasta Bar Night", desc: "Two sauces, garlic bread, everyone picks their pasta shape", cuisine: "Italian" },
  { title: "Hawaiian Luau Dinner", desc: "Teriyaki chicken, pineapple, coconut rice, tropical vibes", cuisine: "Asian" },
  { title: "Nacho Night", desc: "Loaded nachos with all the fixings", cuisine: "Mexican" },
  { title: "Charcuterie Dinner", desc: "Fancy cheese board with meats, crackers, fruit, and dips", cuisine: "Mediterranean" },
  { title: "Wing Night", desc: "Baked wings with 3 sauces: buffalo, honey garlic, BBQ", cuisine: "American" },
  { title: "Sushi Bowl Night", desc: "Deconstructed sushi bowls with rice, salmon, avocado", cuisine: "Asian" },
  { title: "Curry Night", desc: "Chicken tikka masala with naan, basmati rice, and raita", cuisine: "Indian" },
  { title: "Build-Your-Own Bowl", desc: "Rice bowls with chicken, veggies, and pick-your-sauce", cuisine: "Asian" },
  { title: "Mac & Cheese Madness", desc: "Three kinds of mac: classic, buffalo chicken, and bacon", cuisine: "American" },
];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const { planId } = await request.json();
  if (!planId)
    return NextResponse.json({ error: "planId is required" }, { status: 400 });

  const plan = await prisma.foodMealPlan.findFirst({
    where: { id: planId, householdId: household.id },
  });
  if (!plan)
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const recipes = await prisma.foodRecipe.findMany({
    where: { householdId: household.id },
    orderBy: { rating: "desc" },
  });

  if (recipes.length === 0)
    return NextResponse.json({ error: "No recipes found. Add some recipes first!" }, { status: 400 });

  // Look back at LAST 4 WEEKS of plans to avoid repeats
  const fourWeeksAgo = new Date(plan.weekStart);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const recentPlans = await prisma.foodMealPlan.findMany({
    where: {
      householdId: household.id,
      weekStart: { gte: fourWeeksAgo, lt: plan.weekStart },
    },
    include: { slots: { select: { recipeId: true, customMeal: true } } },
  });

  // Frequency map: how many times each recipe appeared recently
  const recentFreq = new Map<string, number>();
  const recentCustom = new Set<string>();
  for (const p of recentPlans) {
    for (const s of p.slots) {
      if (s.recipeId) recentFreq.set(s.recipeId, (recentFreq.get(s.recipeId) || 0) + 1);
      if (s.customMeal) recentCustom.add(s.customMeal.toLowerCase());
    }
  }

  // Cook logs too
  const logs = await prisma.foodCookLog.findMany({
    where: { recipe: { householdId: household.id } },
    orderBy: { cookedAt: "desc" },
    take: 30,
    select: { recipeId: true },
  });
  for (const l of logs) {
    recentFreq.set(l.recipeId, (recentFreq.get(l.recipeId) || 0) + 1);
  }

  const hasKids = household.members.some(
    (m) => m.role === "kid" || m.ageRange === "kid" || m.ageRange === "toddler" || m.ageRange === "teen"
  );

  const byMeal = {
    breakfast: recipes.filter((r) => r.mealType.includes("breakfast")),
    lunch: recipes.filter((r) => r.mealType.includes("lunch") || r.mealType.includes("dinner")),
    dinner: recipes.filter((r) => r.mealType.includes("dinner")),
    snack: recipes.filter((r) => r.mealType.includes("snack") || r.mealType.includes("dessert")),
  };

  const weekCuisines: string[] = [];
  const usedThisWeek = new Set<string>();

  function pick(pool: typeof recipes, kidFriendly: boolean, newCuisine: boolean) {
    if (pool.length === 0) return null;
    const scored = pool.map((r) => {
      let s = Math.random() * 20;
      if (usedThisWeek.has(r.id)) s -= 200;
      s -= (recentFreq.get(r.id) || 0) * 25;
      s += (r.rating || 3) * 5;
      if (kidFriendly && r.tags.includes("kid-friendly")) s += 12;
      if (newCuisine && r.cuisine && !weekCuisines.includes(r.cuisine)) s += 15;
      if ((r.prepTime || 0) + (r.cookTime || 0) <= 30) s += 3;
      return { r, s };
    });
    scored.sort((a, b) => b.s - a.s);
    return scored[0]?.r || null;
  }

  // Creative idea: pick one not recently used
  const hasRecentCreative = recentPlans.some((p) => p.slots.some((s) => s.customMeal?.startsWith("*")));
  const shouldCreative = !hasRecentCreative || recentPlans.length >= 3;
  let creativeIdea: (typeof CREATIVE_IDEAS)[0] | null = null;
  let creativeDay = -1;
  if (shouldCreative) {
    const unused = CREATIVE_IDEAS.filter((c) => !recentCustom.has(c.title.toLowerCase()));
    if (unused.length > 0) {
      creativeIdea = unused[Math.floor(Math.random() * unused.length)];
      creativeDay = 3 + Math.floor(Math.random() * 4); // Wed-Sat
      if (creativeDay >= 7) creativeDay = 5;
    }
  }

  const slots: { day: number; mealType: string; recipeId?: string; customMeal?: string; notes?: string }[] = [];

  const bfFallback = ["Cereal & Fruit", "Toast & Eggs", "Yogurt Parfait", "Oatmeal", "Smoothie Bowl", "Bagels", "Waffles"];
  const lunchFallback = ["Sandwiches", "Leftovers", "Soup & Crackers", "Wraps", "Salad", "PB&J", "Quesadillas"];

  for (let day = 0; day < 7; day++) {
    // Breakfast
    const bf = byMeal.breakfast.length > 0 ? pick(byMeal.breakfast, hasKids, false) : null;
    if (bf) { slots.push({ day, mealType: "breakfast", recipeId: bf.id }); usedThisWeek.add(bf.id); }
    else slots.push({ day, mealType: "breakfast", customMeal: bfFallback[day] });

    // Lunch
    const ln = byMeal.lunch.length > 0 ? pick(byMeal.lunch, hasKids, false) : null;
    if (ln) { slots.push({ day, mealType: "lunch", recipeId: ln.id }); usedThisWeek.add(ln.id); }
    else slots.push({ day, mealType: "lunch", customMeal: lunchFallback[day] });

    // Dinner
    if (day === creativeDay && creativeIdea) {
      slots.push({ day, mealType: "dinner", customMeal: `* ${creativeIdea.title}`, notes: creativeIdea.desc });
    } else if (byMeal.dinner.length > 0) {
      const dn = pick(byMeal.dinner, hasKids && day % 2 === 0, true);
      if (dn) { slots.push({ day, mealType: "dinner", recipeId: dn.id }); usedThisWeek.add(dn.id); if (dn.cuisine) weekCuisines.push(dn.cuisine); }
    }

    // Weekend snack
    if (day >= 5 && byMeal.snack.length > 0) {
      const sn = pick(byMeal.snack, hasKids, false);
      if (sn) { slots.push({ day, mealType: "snack", recipeId: sn.id }); usedThisWeek.add(sn.id); }
    }
  }

  await prisma.foodMealSlot.deleteMany({ where: { planId } });

  const created = await Promise.all(
    slots.map((s) =>
      prisma.foodMealSlot.create({
        data: { planId, day: s.day, mealType: s.mealType, recipeId: s.recipeId || null, customMeal: s.customMeal || null, notes: s.notes || null },
        include: { recipe: { select: { id: true, title: true, slug: true, imageUrl: true, cuisine: true, tags: true } } },
      })
    )
  );

  await prisma.foodMealPlan.update({ where: { id: planId }, data: { status: "active" } });

  return NextResponse.json({
    plan: { ...plan, status: "active", slots: created },
    summary: {
      totalMeals: created.length,
      creativeMeal: creativeIdea ? creativeIdea.title : null,
      cuisinesUsed: [...new Set(weekCuisines)],
      recentWeeksChecked: recentPlans.length,
    },
  });
}
