"use client";

import { useState, useEffect, useCallback } from "react";
import { FoodRecipeCard } from "@/components/food/food-recipe-card";

interface Recipe {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string;
  cuisine?: string;
  mealType: string[];
  prepTime?: number;
  cookTime?: number;
  rating?: number;
  tags: string[];
  timesCooked: number;
}

const CUISINES = ["Italian", "Mexican", "American", "Asian", "Indian", "Mediterranean", "Japanese", "Thai", "Chinese", "French"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "dessert"];
const TIME_FILTERS = [
  { label: "Any Time", value: "" },
  { label: "Under 15 min", value: "15" },
  { label: "Under 30 min", value: "30" },
  { label: "Under 60 min", value: "60" },
];
const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Low-Carb", "Keto"];

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [mealType, setMealType] = useState("");
  const [maxTime, setMaxTime] = useState("");
  const [kidFriendly, setKidFriendly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genCuisine, setGenCuisine] = useState("");
  const [genMealType, setGenMealType] = useState("dinner");
  const [genDietary, setGenDietary] = useState<string[]>([]);

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (cuisine) params.set("cuisine", cuisine);
    if (mealType) params.set("mealType", mealType);
    if (maxTime) params.set("maxTime", maxTime);
    if (kidFriendly) params.set("kidFriendly", "true");
    params.set("page", String(page));
    params.set("limit", "12");

    try {
      const res = await fetch(`/api/food/recipes?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRecipes(data.recipes || []);
        setTotalPages(data.pages || data.totalPages || 1);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [search, cuisine, mealType, maxTime, kidFriendly, page]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/food/recipes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuisine: genCuisine, mealType: genMealType, dietary: genDietary }),
      });
      if (res.ok) {
        setShowGenerateModal(false);
        setGenCuisine("");
        setGenDietary([]);
        fetchRecipes();
      }
    } catch {
      // silent
    } finally {
      setGenerating(false);
    }
  };

  const toggleDietary = (flag: string) => {
    setGenDietary((prev) => (prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]));
  };

  const clearFilters = () => {
    setSearch("");
    setCuisine("");
    setMealType("");
    setMaxTime("");
    setKidFriendly(false);
    setPage(1);
  };

  const hasFilters = search || cuisine || mealType || maxTime || kidFriendly;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div
        className="food-enter"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--food-text)" }}>
          Recipes
        </h1>
        <button
          className="food-btn food-btn-primary food-glow"
          onClick={() => setShowGenerateModal(true)}
        >
          Generate Recipe with AI
        </button>
      </div>

      {/* Search & Filters */}
      <div
        className="food-card food-enter"
        style={{ padding: "1.25rem", marginBottom: "1.5rem", "--enter-delay": "0.1s" } as React.CSSProperties}
      >
        <input
          className="food-input"
          type="text"
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ width: "100%", marginBottom: "1rem" }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          {/* Cuisine chips */}
          {CUISINES.map((c) => (
            <button
              key={c}
              className={`food-tag ${cuisine === c ? "food-tag-pink" : ""}`}
              onClick={() => { setCuisine(cuisine === c ? "" : c); setPage(1); }}
              style={{
                cursor: "pointer",
                border: "1px solid var(--food-border)",
                background: cuisine === c ? "rgba(244, 114, 182, 0.15)" : "white",
                padding: "0.35rem 0.75rem",
                fontSize: "0.8125rem",
              }}
            >
              {c}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.75rem", alignItems: "center" }}>
          {/* Meal type */}
          <select
            className="food-input"
            value={mealType}
            onChange={(e) => { setMealType(e.target.value); setPage(1); }}
            style={{ padding: "0.5rem 0.75rem" }}
          >
            <option value="">All Meals</option>
            {MEAL_TYPES.map((m) => (
              <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
            ))}
          </select>

          {/* Time filter */}
          <select
            className="food-input"
            value={maxTime}
            onChange={(e) => { setMaxTime(e.target.value); setPage(1); }}
            style={{ padding: "0.5rem 0.75rem" }}
          >
            {TIME_FILTERS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {/* Kid-friendly toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", cursor: "pointer", fontSize: "0.875rem", color: "var(--food-text)" }}>
            <input
              type="checkbox"
              checked={kidFriendly}
              onChange={(e) => { setKidFriendly(e.target.checked); setPage(1); }}
              className="food-check"
            />
            Kid-Friendly
          </label>

          {hasFilters && (
            <button
              className="food-btn food-btn-secondary"
              onClick={clearFilters}
              style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Recipe Grid */}
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
      ) : recipes.length === 0 ? (
        <div
          className="food-card food-enter"
          style={{ textAlign: "center", padding: "4rem 2rem", "--enter-delay": "0.2s" } as React.CSSProperties}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📖</div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>
            {hasFilters ? "No recipes match your filters" : "No recipes yet!"}
          </h3>
          <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem" }}>
            {hasFilters
              ? "Try adjusting your filters or search terms"
              : "Start building your recipe collection. Add your family favorites or let AI generate new ones!"}
          </p>
          {!hasFilters && (
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
              <a href="/food/recipes/new" className="food-btn food-btn-primary">
                Add a Recipe
              </a>
              <button className="food-btn food-btn-secondary" onClick={() => setShowGenerateModal(true)}>
                Generate with AI
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {recipes.map((recipe, i) => (
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="food-enter"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "0.75rem",
            marginTop: "2rem",
            "--enter-delay": "0.3s",
          } as React.CSSProperties}
        >
          <button
            className="food-btn food-btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            style={{ opacity: page <= 1 ? 0.5 : 1 }}
          >
            Previous
          </button>
          <span style={{ fontSize: "0.875rem", color: "var(--food-text-secondary)" }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="food-btn food-btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={{ opacity: page >= totalPages ? 0.5 : 1 }}
          >
            Next
          </button>
        </div>
      )}

      {/* Generate Recipe Modal */}
      {showGenerateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowGenerateModal(false); }}
        >
          <div
            className="food-card food-enter"
            style={{ maxWidth: "480px", width: "100%", padding: "2rem" }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>
              Generate a Recipe with AI
            </h2>
            <p style={{ color: "var(--food-text-secondary)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              Tell us what you're in the mood for and we'll create something special!
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.375rem" }}>
                  Cuisine
                </label>
                <select
                  className="food-input"
                  value={genCuisine}
                  onChange={(e) => setGenCuisine(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">Surprise Me!</option>
                  {CUISINES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.375rem" }}>
                  Meal Type
                </label>
                <select
                  className="food-input"
                  value={genMealType}
                  onChange={(e) => setGenMealType(e.target.value)}
                  style={{ width: "100%" }}
                >
                  {MEAL_TYPES.map((m) => (
                    <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.375rem" }}>
                  Dietary Preferences
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {DIETARY_OPTIONS.map((d) => (
                    <button
                      key={d}
                      className={`food-tag ${genDietary.includes(d) ? "food-tag-mint" : ""}`}
                      onClick={() => toggleDietary(d)}
                      style={{
                        cursor: "pointer",
                        border: "1px solid var(--food-border)",
                        background: genDietary.includes(d) ? "rgba(110, 231, 183, 0.15)" : "white",
                        padding: "0.35rem 0.75rem",
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button
                  className="food-btn food-btn-secondary"
                  onClick={() => setShowGenerateModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="food-btn food-btn-primary food-glow"
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ opacity: generating ? 0.7 : 1 }}
                >
                  {generating ? "Generating..." : "Generate Recipe"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
