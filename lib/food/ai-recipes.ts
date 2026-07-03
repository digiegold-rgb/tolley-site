import { chatJSON } from "./ai-client";

interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
}

interface RecipeInstruction {
  step: number;
  text: string;
  duration?: string;
}

interface RecipeNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface GeneratedRecipe {
  title: string;
  slug: string;
  description: string;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  cuisine: string;
  mealType: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  nutrition: RecipeNutrition;
  tags: string[];
}

export interface GenerateRecipeOpts {
  cuisine?: string;
  mealType?: string;
  dietary: string[];
  dislikes: string[];
  servings: number;
  pantryItems?: string[];
  quickMeal?: boolean;
}

export async function generateRecipe(
  opts: GenerateRecipeOpts
): Promise<GeneratedRecipe> {
  const {
    cuisine,
    mealType,
    dietary,
    dislikes,
    servings,
    pantryItems,
    quickMeal,
  } = opts;

  const systemPrompt = `You are a professional chef and recipe developer. Generate creative, family-friendly recipes.
Always respect these dietary restrictions: ${dietary.length > 0 ? dietary.join(", ") : "none"}.
Never include these disliked ingredients/flavors: ${dislikes.length > 0 ? dislikes.join(", ") : "none"}.

Return ONLY valid JSON with this exact structure:
{
  "title": "Recipe Title",
  "slug": "recipe-title",
  "description": "Brief appetizing description",
  "ingredients": [{"name": "...", "quantity": 1, "unit": "cup", "notes": "optional"}],
  "instructions": [{"step": 1, "text": "...", "duration": "5 min"}],
  "cuisine": "...",
  "mealType": ["dinner"],
  "prepTime": 15,
  "cookTime": 30,
  "servings": ${servings},
  "nutrition": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0},
  "tags": ["tag1", "tag2"]
}`;

  const parts: string[] = [];
  parts.push(`Generate a recipe for ${servings} servings.`);
  if (cuisine) parts.push(`Cuisine: ${cuisine}.`);
  if (mealType) parts.push(`Meal type: ${mealType}.`);
  if (quickMeal) parts.push("This should be a quick meal (under 30 min total).");
  if (pantryItems && pantryItems.length > 0) {
    parts.push(
      `Try to use these pantry items I already have: ${pantryItems.join(", ")}.`
    );
  }

  const recipe = await chatJSON<GeneratedRecipe>({
    task: "generate-recipe",
    system: systemPrompt,
    user: parts.join(" "),
    temperature: 0.7,
    maxTokens: 2000,
  });

  // Ensure slug is kebab-case derived from title
  if (!recipe.slug) {
    recipe.slug = recipe.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  return recipe;
}

export interface NutritionInput {
  name: string;
  quantity: number;
  unit: string;
}

export interface NutritionEstimate {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  sugar: number;
}

export async function estimateNutrition(
  ingredients: NutritionInput[]
): Promise<NutritionEstimate> {
  const systemPrompt = `You are a nutrition expert. Estimate the total nutritional content for the combined ingredients.
Return ONLY valid JSON: {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0, "sodium": 0, "sugar": 0}
All values should be numbers. Calories in kcal, macros in grams, sodium in mg.`;

  const ingredientList = ingredients
    .map((i) => `${i.quantity} ${i.unit} ${i.name}`)
    .join("\n");

  return chatJSON<NutritionEstimate>({
    task: "estimate-nutrition",
    system: systemPrompt,
    user: `Estimate the total nutrition for these ingredients:\n${ingredientList}`,
    temperature: 0.3,
    maxTokens: 500,
    timeoutMs: 30000,
  });
}
