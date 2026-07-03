"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  COOKBOOK_COLLECTIONS,
  getCollectionRecipes,
  type CookbookRecipe,
} from "@/lib/food/cookbook-collections";

const RAIL_PREVIEW_LIMIT = 8;

export default function CookbooksPage() {
  const [recipes, setRecipes] = useState<CookbookRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/food/recipes?limit=500")
      .then((r) => r.json())
      .then((data) => setRecipes(data.recipes || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const collections = COOKBOOK_COLLECTIONS.map((c) => ({
    ...c,
    recipes: getCollectionRecipes(c, recipes),
  })).filter((c) => c.recipes.length > 0);

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

      {collections.map((collection, ci) => {
        const hasMore = collection.recipes.length > RAIL_PREVIEW_LIMIT;
        const detailHref = `/food/cookbooks/${collection.id}`;
        return (
          <section
            key={collection.id}
            className="food-enter"
            style={{ marginBottom: "2.5rem", "--enter-delay": `${ci * 0.08}s` } as React.CSSProperties}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
              <Link
                href={detailHref}
                style={{ color: "inherit", textDecoration: "none" }}
                className="food-cookbook-heading-link"
              >
                {collection.emoji} {collection.title}
                <span style={{ fontSize: "0.8125rem", fontWeight: 400, color: "var(--food-text-secondary)", marginLeft: "0.5rem" }}>
                  ({collection.recipes.length})
                </span>
              </Link>
            </h2>
            <div style={{ display: "flex", gap: "1rem", overflowX: "auto", paddingBottom: "0.5rem", scrollSnapType: "x mandatory" }}>
              {collection.recipes.slice(0, RAIL_PREVIEW_LIMIT).map((recipe) => (
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
              {hasMore && (
                <Link
                  href={detailHref}
                  style={{ textDecoration: "none", color: "inherit", flexShrink: 0, scrollSnapAlign: "start" }}
                >
                  <div
                    className="food-card"
                    style={{
                      width: 200,
                      height: "100%",
                      minHeight: 210,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "1rem",
                      textAlign: "center",
                      border: "1px dashed var(--food-border, rgba(74,32,64,0.2))",
                      background: "linear-gradient(135deg, #fce4ec22, #f3e5f522)",
                    }}
                  >
                    <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📖</div>
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--food-text)" }}>
                      View all {collection.recipes.length}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)", marginTop: "0.25rem" }}>
                      See full collection →
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </section>
        );
      })}

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
