"use client";

import Link from "next/link";

interface Recipe {
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

const PASTEL_GRADIENTS = [
  "linear-gradient(135deg, #fce4ec, #f3e5f5)",
  "linear-gradient(135deg, #e8eaf6, #e0f2f1)",
  "linear-gradient(135deg, #fff3e0, #fce4ec)",
  "linear-gradient(135deg, #e0f7fa, #e8f5e9)",
  "linear-gradient(135deg, #f3e5f5, #e8eaf6)",
];

const FOOD_EMOJIS = ["🍝", "🥗", "🍲", "🍰", "🥘", "🍜", "🌮", "🍕"];

const TAG_COLORS = ["food-tag-pink", "food-tag-lavender", "food-tag-mint", "food-tag-peach"];

export function FoodRecipeCard({ recipe }: { recipe: Recipe }) {
  const gradientIndex = recipe.id.charCodeAt(0) % PASTEL_GRADIENTS.length;
  const emojiIndex = recipe.id.charCodeAt(0) % FOOD_EMOJIS.length;
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <Link href={`/food/recipes/${recipe.slug}`} style={{ textDecoration: "none" }}>
      <div className="food-card" style={{ overflow: "hidden", cursor: "pointer" }}>
        {/* Image / Placeholder */}
        <div
          style={{
            height: "160px",
            background: recipe.imageUrl ? `url(${recipe.imageUrl}) center/cover` : PASTEL_GRADIENTS[gradientIndex],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {!recipe.imageUrl && (
            <span style={{ fontSize: "3rem" }}>{FOOD_EMOJIS[emojiIndex]}</span>
          )}
          {recipe.cuisine && (
            <span
              className="food-tag food-tag-lavender"
              style={{ position: "absolute", top: "0.75rem", right: "0.75rem" }}
            >
              {recipe.cuisine}
            </span>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: "1rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>
            {recipe.title}
          </h3>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.8125rem", color: "var(--food-text-secondary)", marginBottom: "0.5rem" }}>
            {totalTime > 0 && <span>⏱️ {totalTime} min</span>}
            {recipe.timesCooked > 0 && <span>🍳 {recipe.timesCooked}x cooked</span>}
          </div>

          {/* Rating */}
          {recipe.rating != null && recipe.rating > 0 && (
            <div style={{ display: "flex", gap: "0.125rem", marginBottom: "0.5rem" }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`food-star${star <= recipe.rating! ? " filled" : ""}`}
                  style={{ cursor: "default", fontSize: "1rem" }}
                >
                  ★
                </span>
              ))}
            </div>
          )}

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
              {recipe.tags.slice(0, 3).map((tag, i) => (
                <span key={tag} className={`food-tag ${TAG_COLORS[i % TAG_COLORS.length]}`}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
