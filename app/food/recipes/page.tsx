"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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

const QUICK_FILTERS = [
  { id: "all", label: "All" },
  { id: "dinner", label: "Dinner", mealType: "dinner" },
  { id: "lunch", label: "Lunch", mealType: "lunch" },
  { id: "breakfast", label: "Breakfast", mealType: "breakfast" },
  { id: "dessert", label: "Dessert", mealType: "dessert" },
  { id: "quick", label: "Quick", maxTime: "30" },
  { id: "healthy", label: "Healthy", tag: "Healthy" },
] as const;

const CUISINES = [
  "Italian",
  "Mexican",
  "American",
  "Asian",
  "Indian",
  "Mediterranean",
  "Japanese",
  "Thai",
  "Chinese",
  "French",
];
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "dessert"];
const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Low-Carb",
  "Keto",
];

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [cuisine, setCuisine] = useState("");
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
    if (kidFriendly) params.set("kidFriendly", "true");

    const filter = QUICK_FILTERS.find((f) => f.id === activeFilter);
    if (filter && "mealType" in filter && filter.mealType) {
      params.set("mealType", filter.mealType);
    }
    if (filter && "maxTime" in filter && filter.maxTime) {
      params.set("maxTime", filter.maxTime);
    }

    params.set("page", String(page));
    params.set("limit", "12");

    try {
      const res = await fetch(`/api/food/recipes?${params}`);
      if (res.ok) {
        const data = await res.json();
        let list: Recipe[] = data.recipes || [];

        // Tag filter is client-side because API doesn't index tags.
        if (filter && "tag" in filter && filter.tag) {
          const needle = filter.tag.toLowerCase();
          list = list.filter((r) =>
            r.tags.some((t) => t.toLowerCase().includes(needle)),
          );
        }
        setRecipes(list);
        setTotalPages(data.pages || data.totalPages || 1);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [search, cuisine, kidFriendly, activeFilter, page]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/food/recipes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuisine: genCuisine,
          mealType: genMealType,
          dietary: genDietary,
        }),
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
    setGenDietary((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag],
    );
  };

  return (
    <div style={{ background: "var(--food-bg-warm)", minHeight: "100vh" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "20px 16px 12px" }}
      >
        <h1
          style={{
            fontFamily: "var(--font-fredoka), system-ui, sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--food-text)",
            margin: 0,
          }}
        >
          Recipes
        </h1>
        <button
          type="button"
          onClick={() => setShowGenerateModal(true)}
          className="cursor-pointer"
          style={{
            background:
              "linear-gradient(135deg, var(--food-pink), var(--food-lavender))",
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "var(--font-fredoka), system-ui, sans-serif",
            padding: "7px 14px",
            borderRadius: 9999,
            border: "none",
            boxShadow: "0 4px 14px rgba(244,114,182,0.35)",
          }}
        >
          ✨ AI Recipe
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "0 16px 12px" }}>
        <input
          type="text"
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{
            width: "100%",
            padding: "10px 14px",
            background: "white",
            border: "1px solid var(--food-border)",
            borderRadius: 12,
            fontSize: 14,
            color: "var(--food-text)",
            fontFamily: "var(--font-sora), sans-serif",
            outline: "none",
          }}
        />
      </div>

      {/* Quick filter chips - horizontal scroll */}
      <div
        className="flex"
        style={{
          gap: 8,
          overflowX: "auto",
          padding: "0 16px 12px",
          scrollbarWidth: "none",
        }}
      >
        {QUICK_FILTERS.map((f) => {
          const active = activeFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setActiveFilter(f.id);
                setPage(1);
              }}
              className="cursor-pointer"
              style={{
                flexShrink: 0,
                padding: "6px 14px",
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                fontFamily: "var(--font-sora), sans-serif",
                border: "1.5px solid",
                borderColor: active
                  ? "var(--food-pink)"
                  : "var(--food-border)",
                background: active ? "rgba(244,114,182,0.10)" : "white",
                color: active ? "#be185d" : "var(--food-text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Advanced filter toggle */}
      <div style={{ padding: "0 16px 8px" }}>
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="cursor-pointer bg-transparent border-0"
          style={{
            color: "var(--food-pink)",
            fontSize: 12,
            fontFamily: "var(--font-sora), sans-serif",
            fontWeight: 500,
            padding: 0,
          }}
        >
          {advancedOpen ? "Hide" : "More"} filters{" "}
          {advancedOpen ? "▲" : "▼"}
        </button>
      </div>

      {advancedOpen && (
        <div
          className="flex flex-wrap items-center"
          style={{ padding: "0 16px 12px", gap: 8 }}
        >
          <select
            value={cuisine}
            onChange={(e) => {
              setCuisine(e.target.value);
              setPage(1);
            }}
            style={{
              padding: "6px 10px",
              background: "white",
              border: "1px solid var(--food-border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--food-text)",
              fontFamily: "var(--font-sora), sans-serif",
            }}
          >
            <option value="">All cuisines</option>
            {CUISINES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label
            className="flex items-center"
            style={{
              gap: 6,
              fontSize: 12,
              color: "var(--food-text)",
              fontFamily: "var(--font-sora), sans-serif",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={kidFriendly}
              onChange={(e) => {
                setKidFriendly(e.target.checked);
                setPage(1);
              }}
            />
            Kid-friendly
          </label>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 16px" }}>
          <div
            style={{
              fontSize: 36,
              animation: "food-sparkle 1.5s ease-in-out infinite",
            }}
          >
            🍳
          </div>
          <p
            style={{
              color: "var(--food-text-secondary)",
              marginTop: 8,
              fontSize: 13,
              fontFamily: "var(--font-sora), sans-serif",
            }}
          >
            Loading recipes...
          </p>
        </div>
      ) : recipes.length === 0 ? (
        <div
          className="text-center"
          style={{
            margin: "16px 16px 0",
            padding: "40px 20px",
            background: "white",
            border: "1px solid var(--food-border)",
            borderRadius: 18,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>📖</div>
          <h3
            style={{
              fontFamily: "var(--font-fredoka), system-ui, sans-serif",
              fontSize: 16,
              fontWeight: 700,
              color: "var(--food-text)",
              marginBottom: 6,
            }}
          >
            {activeFilter !== "all" || search
              ? "No matches"
              : "No recipes yet!"}
          </h3>
          <p
            style={{
              color: "var(--food-text-secondary)",
              fontSize: 13,
              fontFamily: "var(--font-sora), sans-serif",
              marginBottom: 16,
            }}
          >
            {activeFilter !== "all" || search
              ? "Try a different filter or search term."
              : "Start your collection — add a recipe or generate with AI."}
          </p>
          <div className="flex justify-center flex-wrap" style={{ gap: 8 }}>
            <Link
              href="/food/recipes/new"
              className="food-btn food-btn-primary"
            >
              Add a Recipe
            </Link>
            <button
              type="button"
              className="food-btn food-btn-secondary"
              onClick={() => setShowGenerateModal(true)}
            >
              ✨ Generate with AI
            </button>
          </div>
        </div>
      ) : (
        <div
          className="flex flex-col"
          style={{ gap: 10, padding: "0 16px" }}
        >
          {recipes.map((recipe) => (
            <FoodRecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !loading && recipes.length > 0 && (
        <div
          className="flex justify-center items-center"
          style={{ gap: 12, padding: "20px 16px" }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="food-btn food-btn-secondary"
            style={{ opacity: page <= 1 ? 0.5 : 1 }}
          >
            ← Prev
          </button>
          <span
            style={{
              fontSize: 13,
              color: "var(--food-text-secondary)",
              fontFamily: "var(--font-sora), sans-serif",
            }}
          >
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="food-btn food-btn-secondary"
            style={{ opacity: page >= totalPages ? 0.5 : 1 }}
          >
            Next →
          </button>
        </div>
      )}

      <div style={{ height: 24 }} />

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
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGenerateModal(false);
          }}
        >
          <div
            className="food-card food-enter"
            style={{
              maxWidth: 480,
              width: "100%",
              padding: 24,
              background: "white",
              borderRadius: 18,
              border: "1px solid var(--food-border)",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                fontSize: 20,
                fontWeight: 700,
                color: "var(--food-text)",
                marginBottom: 6,
              }}
            >
              ✨ Generate a Recipe
            </h2>
            <p
              style={{
                color: "var(--food-text-secondary)",
                fontSize: 13,
                marginBottom: 20,
                fontFamily: "var(--font-sora), sans-serif",
              }}
            >
              Tell us what you&rsquo;re in the mood for.
            </p>

            <div className="flex flex-col" style={{ gap: 14 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--food-text)",
                    marginBottom: 6,
                    fontFamily: "var(--font-sora), sans-serif",
                  }}
                >
                  Cuisine
                </label>
                <select
                  className="food-input"
                  value={genCuisine}
                  onChange={(e) => setGenCuisine(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">Surprise me!</option>
                  {CUISINES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--food-text)",
                    marginBottom: 6,
                    fontFamily: "var(--font-sora), sans-serif",
                  }}
                >
                  Meal Type
                </label>
                <select
                  className="food-input"
                  value={genMealType}
                  onChange={(e) => setGenMealType(e.target.value)}
                  style={{ width: "100%" }}
                >
                  {MEAL_TYPES.map((m) => (
                    <option key={m} value={m}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--food-text)",
                    marginBottom: 6,
                    fontFamily: "var(--font-sora), sans-serif",
                  }}
                >
                  Dietary Preferences
                </label>
                <div className="flex flex-wrap" style={{ gap: 6 }}>
                  {DIETARY_OPTIONS.map((d) => {
                    const on = genDietary.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDietary(d)}
                        className="cursor-pointer"
                        style={{
                          padding: "6px 12px",
                          borderRadius: 9999,
                          fontSize: 12,
                          fontFamily: "var(--font-sora), sans-serif",
                          border: "1.5px solid",
                          borderColor: on
                            ? "var(--food-mint)"
                            : "var(--food-border)",
                          background: on
                            ? "rgba(110,231,183,0.15)"
                            : "white",
                          color: on ? "#047857" : "var(--food-text-secondary)",
                        }}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className="flex justify-end"
                style={{ gap: 8, marginTop: 6 }}
              >
                <button
                  type="button"
                  className="food-btn food-btn-secondary"
                  onClick={() => setShowGenerateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="food-btn food-btn-primary food-glow"
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ opacity: generating ? 0.7 : 1 }}
                >
                  {generating ? "Generating…" : "Generate Recipe"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
