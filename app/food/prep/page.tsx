"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Recipe {
  id: string;
  title: string;
  slug: string;
  prepTime?: number | null;
  cookTime?: number | null;
  servings?: number | null;
  tags: string[];
  cuisine?: string | null;
}

interface PrepTask {
  time: string;
  description: string;
  recipeTitle: string;
  recipeSlug?: string;
  durationMinutes: number;
}

interface PrepPlan {
  timeline: PrepTask[];
  shoppingList: { category: string; items: string[] }[];
  tips: string[];
}

const RECIPE_COLORS = [
  "var(--food-pink)",
  "var(--food-lavender)",
  "var(--food-mint)",
  "var(--food-peach)",
  "var(--food-rose-gold)",
];

function getNextSunday(): string {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + daysUntilSunday);
  return sunday.toISOString().split("T")[0];
}

export default function PrepPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prepDate, setPrepDate] = useState(getNextSunday());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<PrepPlan | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/food/recipes?limit=50")
      .then((r) => r.json())
      .then((data) => {
        const list = data.recipes || data;
        setRecipes(Array.isArray(list) ? list : []);
      })
      .catch(() => setError("Couldn't load recipes"))
      .finally(() => setLoading(false));
  }, []);

  const toggleRecipe = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generatePlan = async () => {
    if (selected.size === 0) return;
    setGenerating(true);
    setError("");
    setPlan(null);
    try {
      const res = await fetch("/api/food/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeIds: Array.from(selected),
          prepDate,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate plan");
      const data = await res.json();
      // Map AI response fields to what the page expects
      if (data.timeline) {
        data.timeline = data.timeline.map((t: any) => ({
          time: t.time,
          description: t.description || t.task,
          recipeTitle: t.recipeTitle || t.recipe,
          recipeSlug: t.recipeSlug,
          durationMinutes: t.durationMinutes || t.duration || 0,
        }));
      }
      setPlan(data);
    } catch {
      setError("Couldn't generate the prep plan. Try again!");
    } finally {
      setGenerating(false);
    }
  };

  const recipeColorMap = new Map<string, string>();
  let colorIdx = 0;
  const getRecipeColor = (title: string) => {
    if (!recipeColorMap.has(title)) {
      recipeColorMap.set(title, RECIPE_COLORS[colorIdx % RECIPE_COLORS.length]);
      colorIdx++;
    }
    return recipeColorMap.get(title)!;
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1
        className="food-enter"
        style={{ fontSize: "2rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "0.5rem" }}
      >
        Meal Prep Sunday {"🧊"}
      </h1>
      <p
        className="food-enter"
        style={{
          color: "var(--food-text-secondary)",
          marginBottom: "2rem",
          "--enter-delay": "0.05s",
        } as React.CSSProperties}
      >
        Select recipes to batch cook, pick a date, and get an organized prep timeline.
      </p>

      {/* Step 1: Select recipes */}
      {!plan && (
        <>
          <section
            className="food-enter"
            style={{ marginBottom: "2rem", "--enter-delay": "0.1s" } as React.CSSProperties}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
              Step 1: Pick recipes to batch cook
            </h2>

            {loading ? (
              <p style={{ color: "var(--food-text-secondary)" }}>Loading recipes...</p>
            ) : recipes.length === 0 ? (
              <div className="food-card" style={{ padding: "2rem", textAlign: "center" }}>
                <p style={{ color: "var(--food-text-secondary)", marginBottom: "1rem" }}>
                  No recipes yet! Add some first.
                </p>
                <Link href="/food/recipes/new" className="food-btn food-btn-primary">
                  Add Recipe
                </Link>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: "1rem",
                }}
              >
                {recipes.map((recipe) => {
                  const isSelected = selected.has(recipe.id);
                  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
                  return (
                    <div
                      key={recipe.id}
                      className="food-card"
                      onClick={() => toggleRecipe(recipe.id)}
                      style={{
                        padding: "1.25rem",
                        cursor: "pointer",
                        border: isSelected
                          ? "2px solid var(--food-pink)"
                          : "1px solid var(--food-border)",
                        background: isSelected
                          ? "rgba(244, 114, 182, 0.06)"
                          : "var(--food-bg-warm)",
                        position: "relative",
                      }}
                    >
                      {isSelected && (
                        <div
                          style={{
                            position: "absolute",
                            top: "0.75rem",
                            right: "0.75rem",
                            width: "1.5rem",
                            height: "1.5rem",
                            borderRadius: "50%",
                            background: "var(--food-pink)",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                          }}
                        >
                          {"✓"}
                        </div>
                      )}
                      <h3
                        style={{
                          fontSize: "1rem",
                          fontWeight: 600,
                          color: "var(--food-text)",
                          marginBottom: "0.5rem",
                          paddingRight: isSelected ? "2rem" : 0,
                        }}
                      >
                        {recipe.title}
                      </h3>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.375rem",
                          fontSize: "0.8125rem",
                          color: "var(--food-text-secondary)",
                        }}
                      >
                        {totalTime > 0 && <span>{"⏱️"} {totalTime} min</span>}
                        {recipe.cuisine && (
                          <span className="food-tag food-tag-lavender">{recipe.cuisine}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Step 2: Pick date */}
          <section
            className="food-enter"
            style={{ marginBottom: "2rem", "--enter-delay": "0.2s" } as React.CSSProperties}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
              Step 2: Pick your prep date
            </h2>
            <input
              type="date"
              className="food-input"
              value={prepDate}
              onChange={(e) => setPrepDate(e.target.value)}
              style={{ fontSize: "1rem" }}
            />
          </section>

          {/* Generate button */}
          <div
            className="food-enter"
            style={{ textAlign: "center", "--enter-delay": "0.3s" } as React.CSSProperties}
          >
            <button
              className="food-btn food-btn-primary food-glow"
              onClick={generatePlan}
              disabled={selected.size === 0 || generating}
              style={{
                fontSize: "1.125rem",
                padding: "0.875rem 2rem",
                opacity: selected.size === 0 ? 0.5 : 1,
              }}
            >
              {generating ? "Generating..." : `Generate Prep Plan (${selected.size} recipes)`}
            </button>
            {error && (
              <p style={{ color: "#ef4444", marginTop: "0.75rem" }}>{error}</p>
            )}
          </div>
        </>
      )}

      {/* Results: Timeline */}
      {plan && (
        <div className="food-enter">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)" }}>
              {"📋"} Your Prep Timeline
            </h2>
            <button className="food-btn food-btn-secondary" onClick={() => setPlan(null)}>
              {"← Change Recipes"}
            </button>
          </div>

          {/* Timeline */}
          <div
            style={{
              position: "relative",
              paddingLeft: "2rem",
              borderLeft: "3px solid var(--food-border)",
              marginBottom: "2rem",
            }}
          >
            {(plan.timeline || []).map((task, i) => {
              const color = getRecipeColor(task.recipeTitle);
              return (
                <div
                  key={i}
                  className="food-enter"
                  style={{
                    position: "relative",
                    marginBottom: "1.25rem",
                    "--enter-delay": `${i * 0.08}s`,
                  } as React.CSSProperties}
                >
                  {/* Timeline dot */}
                  <div
                    style={{
                      position: "absolute",
                      left: "-2.625rem",
                      top: "0.5rem",
                      width: "1.25rem",
                      height: "1.25rem",
                      borderRadius: "50%",
                      background: color,
                      border: "3px solid var(--food-bg-warm)",
                    }}
                  />
                  <div
                    className="food-card"
                    style={{
                      padding: "1rem 1.25rem",
                      borderLeft: `3px solid ${color}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--food-text-secondary)" }}>
                        {task.time}
                      </span>
                      <span
                        className="food-tag"
                        style={{
                          background: `${color}20`,
                          color: color,
                        }}
                      >
                        {task.recipeTitle}
                      </span>
                      {task.durationMinutes > 0 && (
                        <span style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>
                          {"⏱️"} {task.durationMinutes} min
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, color: "var(--food-text)", fontSize: "0.9375rem" }}>
                      {task.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Shopping list */}
          {plan.shoppingList && plan.shoppingList.length > 0 && (
            <section style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
                {"🛒"} Consolidated Shopping List
              </h2>
              <div className="food-card" style={{ padding: "1.5rem" }}>
                {plan.shoppingList.map((group) => (
                  <div key={group.category} className="food-aisle-group">
                    <div className="food-aisle-header">{group.category}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      {group.items.map((item) => (
                        <div
                          key={item}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontSize: "0.9375rem",
                            color: "var(--food-text)",
                          }}
                        >
                          <span style={{ color: "var(--food-text-secondary)" }}>{"•"}</span>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tips */}
          {plan.tips && plan.tips.length > 0 && (
            <section style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
                {"💡"} Prep Tips
              </h2>
              <div className="food-card" style={{ padding: "1.25rem" }}>
                <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {plan.tips.map((tip, i) => (
                    <li key={i} style={{ color: "var(--food-text)", lineHeight: 1.5 }}>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Start Prep Mode */}
          {plan.timeline && plan.timeline.length > 0 && (
            <div style={{ textAlign: "center" }}>
              {(() => {
                const firstRecipe = recipes.find((r) =>
                  r.title === plan.timeline[0]?.recipeTitle
                );
                const slug = firstRecipe?.slug;
                return slug ? (
                  <Link
                    href={`/food/cook/${slug}`}
                    className="food-btn food-btn-primary food-glow"
                    style={{ fontSize: "1.125rem", padding: "0.875rem 2rem" }}
                  >
                    {"🔥"} Start Prep Mode
                  </Link>
                ) : (
                  <button
                    className="food-btn food-btn-primary food-glow"
                    style={{ fontSize: "1.125rem", padding: "0.875rem 2rem", opacity: 0.5 }}
                    disabled
                  >
                    {"🔥"} Start Prep Mode
                  </button>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
