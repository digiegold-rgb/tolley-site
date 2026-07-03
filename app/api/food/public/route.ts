import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/food/public
 *
 * Public read of Ruthann's Kitchen. Product metadata + sample recipe shape.
 * No user-private meal plans, pantry, or family data.
 */
export async function GET() {
  return NextResponse.json(
    {
      product: "Ruthann's Kitchen",
      url: "https://www.tolley.io/food",
      summary:
        "Family meal planning, pantry management, recipes, and grocery price comparison across Walmart and Sam's Club.",
      pricing: { annual: 39, currency: "USD", trial: "14 days" },
      stripe: { productId: "prod_UIvHHpyQzxfIP3", priceId: "price_1TKJR829zOZYc3GpfJo2mI27" },
      capabilities: [
        "Weekly meal planning with calendar",
        "Pantry tracker with low-stock alerts",
        "Recipe library with photo/video imports",
        "Walmart + Sam's Club price comparison (auto-fetch)",
        "Grocery list generation from meal plan",
        "Multi-family-member sharing",
      ],
      sampleRecipe: {
        title: "Crockpot White Chicken Chili",
        ingredients: ["2 lb chicken breast", "1 can great northern beans", "1 cup salsa verde", "1 packet taco seasoning"],
        servings: 6,
        prepMinutes: 10,
        cookMinutes: 240,
      },
      schemas: {
        Recipe: { title: "string", ingredients: "string[]", servings: "number", instructions: "string[]" },
        MealPlan: { weekStart: "ISO date", meals: "Recipe[][7]" },
        PantryItem: { name: "string", quantity: "number", unit: "string", expiresAt: "ISO date?" },
      },
      cta: {
        signup: "https://www.tolley.io/food",
        pricing: "https://www.tolley.io/food#pricing",
        groceryCompare: "https://www.tolley.io/food/compare",
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=600, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
