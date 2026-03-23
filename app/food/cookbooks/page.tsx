"use client";

import { useState, useEffect } from "react";
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

interface Collection {
  title: string;
  emoji: string;
  recipes: Recipe[];
}

export default function CookbooksPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/food/recipes?limit=200")
      .then((r) => r.json())
      .then((data) => setRecipes(data.recipes || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Build collections
  const collections: Collection[] = [];

  // Favorites (4+ stars)
  const favorites = recipes.filter((r) => (r.rating || 0) >= 4);
  if (favorites.length > 0) {
    collections.push({ title: "Family Favorites", emoji: "💕", recipes: favorites });
  }

  // Most Cooked
  const mostCooked = [...recipes].filter((r) => r.timesCooked > 0).sort((a, b) => b.timesCooked - a.timesCooked);
  if (mostCooked.length > 0) {
    collections.push({ title: "Most Cooked", emoji: "🔥", recipes: mostCooked.slice(0, 10) });
  }

  // Quick meals (under 30 min)
  const quickMeals = recipes.filter((r) => ((r.prepTime || 0) + (r.cookTime || 0)) <= 30 && ((r.prepTime || 0) + (r.cookTime || 0)) > 0);
  if (quickMeals.length > 0) {
    collections.push({ title: "Quick & Easy (Under 30 Min)", emoji: "⚡", recipes: quickMeals });
  }

  // Kid-Friendly
  const kidFriendly = recipes.filter((r) => r.tags.includes("kid-friendly"));
  if (kidFriendly.length > 0) {
    collections.push({ title: "Kid Approved", emoji: "👶", recipes: kidFriendly });
  }

  // By cuisine
  const cuisines = ["American", "Mexican", "Italian", "Asian", "Southern", "Mediterranean"];
  for (const c of cuisines) {
    const byC = recipes.filter((r) => r.cuisine === c);
    if (byC.length > 0) {
      const emoji = c === "American" ? "🇺🇸" : c === "Mexican" ? "🌮" : c === "Italian" ? "🍝" : c === "Asian" ? "🥢" : c === "Southern" ? "🍗" : "🫒";
      collections.push({ title: `${c} Kitchen`, emoji, recipes: byC });
    }
  }

  // Comfort Food
  const comfort = recipes.filter((r) => r.tags.includes("comfort"));
  if (comfort.length > 0) {
    collections.push({ title: "Comfort Food", emoji: "🛋️", recipes: comfort });
  }

  // Breakfast
  const breakfast = recipes.filter((r) => r.mealType.includes("breakfast"));
  if (breakfast.length > 0) {
    collections.push({ title: "Breakfast & Brunch", emoji: "🥞", recipes: breakfast });
  }

  // Slow Cooker
  const slowCooker = recipes.filter((r) => r.tags.includes("slow-cooker") || (r.cookTime || 0) >= 120);
  if (slowCooker.length > 0) {
    collections.push({ title: "Set It & Forget It", emoji: "🫕", recipes: slowCooker });
  }

  // Healthy
  const healthy = recipes.filter((r) => r.tags.includes("healthy") || r.tags.includes("light") || r.tags.includes("fresh"));
  if (healthy.length > 0) {
    collections.push({ title: "Healthy & Light", emoji: "🥗", recipes: healthy });
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem" }}>📚</div>
        <p style={{ color: "var(--food-text-secondary)", marginTop: "1rem" }}>Loading cookbooks...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div className="food-enter" style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "var(--food-text)" }}>
          📚 Cookbooks
        </h1>
        <p style={{ color: "var(--food-text-secondary)", marginTop: "0.25rem" }}>
          {recipes.length} recipes organized into collections
        </p>
      </div>

      {collections.map((collection, ci) => (
        <section
          key={collection.title}
          className="food-enter"
          style={{ marginBottom: "2.5rem", "--enter-delay": `${ci * 0.08}s` } as React.CSSProperties}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            {collection.emoji} {collection.title}
            <span style={{ fontSize: "0.8125rem", fontWeight: 400, color: "var(--food-text-secondary)", marginLeft: "0.5rem" }}>
              ({collection.recipes.length})
            </span>
          </h2>
          <div style={{ display: "flex", gap: "1rem", overflowX: "auto", paddingBottom: "0.5rem", scrollSnapType: "x mandatory" }}>
            {collection.recipes.slice(0, 8).map((recipe) => (
              <Link
                key={recipe.id}
                href={`/food/recipes/${recipe.slug}`}
                style={{ textDecoration: "none", color: "inherit", flexShrink: 0, scrollSnapAlign: "start" }}
              >
                <div className="food-card" style={{ width: 200, overflow: "hidden" }}>
                  <div style={{
                    height: 130,
                    background: recipe.imageUrl
                      ? `url(${recipe.imageUrl}) center/cover`
                      : "linear-gradient(135deg, #fce4ec, #f3e5f5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {!recipe.imageUrl && <span style={{ fontSize: "2rem" }}>🍽️</span>}
                  </div>
                  <div style={{ padding: "0.75rem" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--food-text)", lineHeight: 1.3, marginBottom: "0.375rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {recipe.title}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>
                      {((recipe.prepTime || 0) + (recipe.cookTime || 0)) > 0 && (
                        <span>⏱ {(recipe.prepTime || 0) + (recipe.cookTime || 0)}m</span>
                      )}
                      {recipe.rating && recipe.rating > 0 && <span>⭐ {recipe.rating.toFixed(1)}</span>}
                      {recipe.timesCooked > 0 && <span>🍳 {recipe.timesCooked}x</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {collections.length === 0 && (
        <div className="food-card" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📚</div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>
            No recipes yet!
          </h3>
          <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem" }}>
            Add some recipes to start building your cookbook collections.
          </p>
          <Link href="/food/recipes" className="food-btn food-btn-primary">Browse Recipes</Link>
        </div>
      )}
    </div>
  );
}
