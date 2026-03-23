const VLLM_URL = process.env.VLLM_URL || "http://127.0.0.1:8355/v1";
const MODEL = "Qwen/Qwen3.5-35B-A3B-FP8";

export interface PantryItem {
  name: string;
  expiresAt?: Date;
  quantity: number;
}

export interface RecipeSuggestion {
  title: string;
  slug: string;
  description: string;
  usesExpiring: string[];
  pantryItemsUsed: string[];
  missingIngredients: string[];
  estimatedTime: number;
  mealType: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface SuggestFromPantryOpts {
  pantryItems: PantryItem[];
  dietary: string[];
  dislikes: string[];
  recentRecipes: string[];
  servings: number;
}

export async function suggestFromPantry(
  opts: SuggestFromPantryOpts
): Promise<RecipeSuggestion[]> {
  const { pantryItems, dietary, dislikes, recentRecipes, servings } = opts;

  // Sort by expiration — soonest first, no-date last
  const sorted = [...pantryItems].sort((a, b) => {
    if (!a.expiresAt && !b.expiresAt) return 0;
    if (!a.expiresAt) return 1;
    if (!b.expiresAt) return -1;
    return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
  });

  const expiringItems = sorted
    .filter((item) => {
      if (!item.expiresAt) return false;
      const daysUntilExpiry =
        (new Date(item.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry <= 5;
    })
    .map((i) => i.name);

  const pantryList = sorted
    .map((i) => {
      const exp = i.expiresAt
        ? ` (expires ${new Date(i.expiresAt).toISOString().split("T")[0]})`
        : "";
      return `- ${i.quantity}x ${i.name}${exp}`;
    })
    .join("\n");

  const systemPrompt = `You are a meal planning assistant. Suggest 3-5 recipes that can be made primarily from the user's available pantry items. Prioritize using items that are expiring soon.

Rules:
- Respect dietary restrictions: ${dietary.length > 0 ? dietary.join(", ") : "none"}
- Avoid disliked ingredients: ${dislikes.length > 0 ? dislikes.join(", ") : "none"}
- Avoid recently made recipes: ${recentRecipes.length > 0 ? recentRecipes.join(", ") : "none"}
- Target ${servings} servings per recipe
- Minimize missing ingredients (prefer recipes where user has most items)
- Prioritize using expiring items: ${expiringItems.length > 0 ? expiringItems.join(", ") : "none expiring soon"}

Return ONLY a valid JSON array:
[{
  "title": "Recipe Title",
  "slug": "recipe-title",
  "description": "Brief description",
  "usesExpiring": ["item1"],
  "pantryItemsUsed": ["item1", "item2"],
  "missingIngredients": ["item3"],
  "estimatedTime": 30,
  "mealType": "dinner",
  "difficulty": "easy"
}]`;

  const userPrompt = `Here are my current pantry items:\n${pantryList}\n\nSuggest recipes I can make.`;

  const res = await fetch(`${VLLM_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2500,
    }),
    signal: AbortSignal.timeout(60000),
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\[[\s\S]*\]/);

  if (!jsonMatch) {
    throw new Error("Failed to parse recipe suggestions from AI response");
  }

  const suggestions: RecipeSuggestion[] = JSON.parse(jsonMatch[0]);

  // Ensure slugs exist
  for (const s of suggestions) {
    if (!s.slug) {
      s.slug = s.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }
  }

  return suggestions;
}
