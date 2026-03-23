// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const sp = request.nextUrl.searchParams;
  const cuisine = sp.get("cuisine");
  const mealType = sp.get("mealType");
  const tag = sp.get("tag");
  const search = sp.get("search");
  const kidFriendly = sp.get("kidFriendly");
  const maxTime = sp.get("maxTime");
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { householdId: household.id };

  if (cuisine) where.cuisine = cuisine;
  if (mealType) where.mealType = { has: mealType };
  if (tag) where.tags = { has: tag };
  if (kidFriendly === "true") where.tags = { has: "kid-friendly" };
  if (search) where.title = { contains: search, mode: "insensitive" };

  const [recipes, total] = await Promise.all([
    prisma.foodRecipe.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.foodRecipe.count({ where }),
  ]);

  // Post-filter maxTime (prepTime + cookTime)
  const filtered =
    maxTime
      ? recipes.filter(
          (r) => (r.prepTime || 0) + (r.cookTime || 0) <= Number(maxTime)
        )
      : recipes;

  const totalPages = Math.ceil(total / limit);
  return NextResponse.json({
    recipes: filtered,
    total,
    page,
    pages: totalPages,
    totalPages,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await request.json();
  const {
    title,
    description,
    ingredients,
    instructions,
    cuisine,
    mealType,
    prepTime,
    cookTime,
    servings,
    tags,
    imageUrl,
    source,
  } = body;

  if (!title || !ingredients || !instructions)
    return NextResponse.json(
      { error: "title, ingredients, and instructions are required" },
      { status: 400 }
    );

  // Generate slug from title
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Check uniqueness
  let slug = baseSlug;
  let counter = 1;
  while (
    await prisma.foodRecipe.findUnique({
      where: { householdId_slug: { householdId: household.id, slug } },
    })
  ) {
    counter++;
    slug = `${baseSlug}-${counter}`;
  }

  const recipe = await prisma.foodRecipe.create({
    data: {
      householdId: household.id,
      title,
      slug,
      description: description || null,
      ingredients,
      instructions,
      cuisine: cuisine || null,
      mealType: mealType || [],
      prepTime: prepTime ? Number(prepTime) : null,
      cookTime: cookTime ? Number(cookTime) : null,
      servings: servings ? Number(servings) : 4,
      tags: tags || [],
      imageUrl: imageUrl || null,
      source: source || null,
    },
  });

  return NextResponse.json(
    { recipe, id: recipe.id, slug: recipe.slug, title: recipe.title },
    { status: 201 }
  );
}
