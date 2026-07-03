"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FoodRecipeCard } from "@/components/food/food-recipe-card";
import {
  findCollection,
  getCollectionRecipes,
  type CookbookRecipe,
} from "@/lib/food/cookbook-collections";

type SortKey = "default" | "most-cooked" | "highest-rated" | "quickest" | "recent";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "most-cooked", label: "Most Cooked" },
  { value: "highest-rated", label: "Highest Rated" },
  { value: "quickest", label: "Quickest" },
  { value: "recent", label: "Recently Added" },
];

function applySort(recipes: CookbookRecipe[], key: SortKey): CookbookRecipe[] {
  if (key === "default") return recipes;
  const copy = [...recipes];
  if (key === "most-cooked") {
    copy.sort((a, b) => b.timesCooked - a.timesCooked);
  } else if (key === "highest-rated") {
    copy.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (key === "quickest") {
    const t = (r: CookbookRecipe) => (r.prepTime || 0) + (r.cookTime || 0) || Infinity;
    copy.sort((a, b) => t(a) - t(b));
  }
  return copy;
}

export default function CookbookCollectionPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const collection = findCollection(id);

  const [recipes, setRecipes] = useState<CookbookRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("default");

  useEffect(() => {
    fetch("/api/food/recipes?limit=500")
      .then((r) => r.json())
      .then((data) => setRecipes(data.recipes || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!collection) return [];
    return getCollectionRecipes(collection, recipes);
  }, [collection, recipes]);

  const sorted = useMemo(() => applySort(filtered, sort), [filtered, sort]);

  if (!collection) {
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div className="food-card" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🤔</div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>
            Category not found
          </h3>
          <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem" }}>
            We couldn&apos;t find a cookbook collection called &ldquo;{id}&rdquo;.
          </p>
          <Link href="/food/cookbooks" className="food-btn food-btn-primary">
            ← Back to Cookbooks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div className="food-enter" style={{ marginBottom: "1.5rem" }}>
        <Link
          href="/food/cookbooks"
          style={{
            color: "var(--food-text-secondary)",
            textDecoration: "none",
            fontSize: "0.875rem",
            display: "inline-block",
            marginBottom: "0.75rem",
          }}
        >
          ← Cookbooks
        </Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "var(--food-text)" }}>
            {collection.emoji} {collection.title}
            <span style={{ fontSize: "1rem", fontWeight: 400, color: "var(--food-text-secondary)", marginLeft: "0.625rem" }}>
              ({filtered.length})
            </span>
          </h1>
          {filtered.length > 1 && (
            <label style={{ fontSize: "0.875rem", color: "var(--food-text-secondary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              Sort:
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="food-input"
                style={{ padding: "0.375rem 0.625rem", fontSize: "0.875rem" }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {loading ? (
        <div
          className="food-enter"
          style={{ textAlign: "center", padding: "4rem 2rem", "--enter-delay": "0.2s" } as React.CSSProperties}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem", animation: "food-sparkle 1.5s ease-in-out infinite" }}>
            🍳
          </div>
          <p style={{ color: "var(--food-text-secondary)" }}>Loading recipes...</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="food-card" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📖</div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>
            No recipes in this collection yet
          </h3>
          <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem" }}>
            Add recipes that match &ldquo;{collection.title}&rdquo; to see them here.
          </p>
          <Link href="/food/recipes" className="food-btn food-btn-primary">
            Browse All Recipes
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {sorted.map((recipe, i) => (
            <div
              key={recipe.id}
              className="food-enter"
              style={{ "--enter-delay": `${0.05 * i}s` } as React.CSSProperties}
            >
              <FoodRecipeCard recipe={recipe} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
