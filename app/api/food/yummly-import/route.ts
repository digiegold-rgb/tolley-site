/**
 * POST /api/food/yummly-import
 *
 * Accepts a Yummly/PlateJoy/generic recipe export (.zip or raw .json file) and
 * imports the recipes into the current user's FoodHousehold. Free for
 * authenticated users (subscription not required) so this doubles as a lead
 * magnet for the "Yummly refugee" funnel.
 *
 * Request: multipart/form-data with field `file` = .zip or .json
 * Response: { total, created, skipped, failed, sampleTitles: string[] }
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseYummlyZip, parseRawJson } from "@/lib/food/yummly-parser";
import { normalizeRecipeBatch } from "@/lib/food/yummly-normalizer";
import { trackFoodEvent } from "@/lib/food/track";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min for large imports

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB cap
const MAX_RECIPES_PER_IMPORT = 500;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Missing form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB)` },
      { status: 413 }
    );
  }

  // Make sure a household exists for this user before we start inserting.
  const household = await prisma.foodHousehold.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      name: session.user.name
        ? `${session.user.name}'s Kitchen`
        : "My Kitchen",
    },
    update: {},
  });

  // Parse file
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let candidates;
  try {
    const name = file.name.toLowerCase();
    if (name.endsWith(".zip")) {
      candidates = await parseYummlyZip(buffer);
    } else if (name.endsWith(".json")) {
      const json = JSON.parse(buffer.toString("utf-8"));
      candidates = parseRawJson(json);
    } else {
      // Try .zip first, fall back to JSON
      try {
        candidates = await parseYummlyZip(buffer);
      } catch {
        candidates = parseRawJson(JSON.parse(buffer.toString("utf-8")));
      }
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: "Could not parse file. Upload your Yummly or PlateJoy export as .zip or .json.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 }
    );
  }

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "No recipes found in file. If this is a Yummly export, try uploading the raw .zip." },
      { status: 400 }
    );
  }

  // Cap to prevent runaway AI cost
  const capped = candidates.slice(0, MAX_RECIPES_PER_IMPORT);

  // Normalize with AI in batches
  const { normalized, failed } = await normalizeRecipeBatch(capped);

  // Insert with dedup (skip titles that already exist for this household)
  const existingSlugs = new Set(
    (
      await prisma.foodRecipe.findMany({
        where: { householdId: household.id },
        select: { slug: true },
      })
    ).map((r) => r.slug)
  );

  let created = 0;
  let skipped = 0;
  const createdTitles: string[] = [];

  for (const recipe of normalized) {
    let slug = recipe.slug;
    // Ensure uniqueness within this household
    if (existingSlugs.has(slug)) {
      skipped += 1;
      continue;
    }

    try {
      await prisma.foodRecipe.create({
        data: {
          householdId: household.id,
          title: recipe.title,
          slug,
          description: recipe.description || null,
          ingredients: recipe.ingredients as unknown as object,
          instructions: recipe.instructions as unknown as object,
          cuisine: recipe.cuisine || null,
          mealType: recipe.mealType || [],
          prepTime: recipe.prepTime || null,
          cookTime: recipe.cookTime || null,
          servings: recipe.servings || 4,
          nutrition: recipe.nutrition as unknown as object,
          tags: recipe.tags || [],
          imageUrl: recipe.imageUrl || null,
          source: recipe.source || "imported",
          aiGenerated: false,
        },
      });
      existingSlugs.add(slug);
      created += 1;
      if (createdTitles.length < 10) createdTitles.push(recipe.title);
    } catch (err) {
      console.warn(`[yummly-import] failed to insert "${recipe.title}"`, err);
      skipped += 1;
    }
  }

  if (created > 0) {
    void trackFoodEvent(household.id, "recipe_imported", {
      created,
      skipped,
      failed,
      total: candidates.length,
    });
  }

  return NextResponse.json({
    total: candidates.length,
    parsed: normalized.length,
    created,
    skipped,
    failed,
    sampleTitles: createdTitles,
    capped: candidates.length > MAX_RECIPES_PER_IMPORT,
  });
}
