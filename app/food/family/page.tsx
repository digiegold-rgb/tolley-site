"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface TopCuisine {
  cuisine: string;
  avgRating: number;
  count: number;
}

interface TopRecipe {
  title: string;
  rating: number;
  timesCooked: number;
}

interface FamilyData {
  totalMealsCooked: number;
  avgRating: number;
  topCuisines: TopCuisine[];
  topRecipes: TopRecipe[];
  avoidPatterns: string[];
  kidFriendlySuccessRate: number;
}

export default function FamilyPage() {
  const [data, setData] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/food/family")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((d) => setData(d))
      .catch(() => setError("Couldn't load family data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem", animation: "food-fade-up 0.8s ease-in-out infinite alternate" }}>
          {"👨‍👩‍👧‍👦"}
        </div>
        <p style={{ color: "var(--food-text-secondary)" }}>Loading family taste profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem", textAlign: "center" }}>
        <p style={{ color: "#ef4444" }}>{error}</p>
      </div>
    );
  }

  // Empty state
  if (!data || data.totalMealsCooked === 0) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <h1
          className="food-enter"
          style={{ fontSize: "2rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "2rem" }}
        >
          Family Taste Profile {"👨‍👩‍👧‍👦"}
        </h1>
        <div
          className="food-card food-enter"
          style={{
            padding: "3rem 2rem",
            textAlign: "center",
            "--enter-delay": "0.1s",
          } as React.CSSProperties}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{"🍳"}</div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>
            No cook logs yet!
          </h3>
          <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem", maxWidth: "400px", margin: "0 auto 1.5rem" }}>
            Start cooking and rating recipes to build your family taste profile!
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/food/tonight" className="food-btn food-btn-primary food-glow">
              What's For Dinner?
            </Link>
            <Link href="/food/recipes" className="food-btn food-btn-secondary">
              Browse Recipes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const maxCuisineRating = Math.max(...(data.topCuisines || []).map((c) => c.avgRating), 5);

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1
        className="food-enter"
        style={{ fontSize: "2rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "2rem" }}
      >
        Family Taste Profile {"👨‍👩‍👧‍👦"}
      </h1>

      {/* Stats row */}
      <div
        className="food-enter"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
          "--enter-delay": "0.1s",
        } as React.CSSProperties}
      >
        <div className="food-card" style={{ padding: "1.25rem", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--food-pink)" }}>
            {data.totalMealsCooked}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)" }}>Meals Cooked</div>
        </div>
        <div className="food-card" style={{ padding: "1.25rem", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--food-lavender)" }}>
            {data.avgRating.toFixed(1)}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)" }}>Avg Rating</div>
        </div>
        <div className="food-card" style={{ padding: "1.25rem", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--food-mint)" }}>
            {(data.topCuisines && data.topCuisines[0]?.cuisine) || "---"}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)" }}>Fav Cuisine</div>
        </div>
      </div>

      {/* Top Cuisines bar chart */}
      {data.topCuisines && data.topCuisines.length > 0 && (
        <section
          className="food-enter"
          style={{ marginBottom: "2rem", "--enter-delay": "0.2s" } as React.CSSProperties}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            {"🌍"} Top Cuisines
          </h2>
          <div className="food-card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {data.topCuisines.map((c, i) => {
                const barColors = [
                  "var(--food-pink)",
                  "var(--food-lavender)",
                  "var(--food-mint)",
                  "var(--food-peach)",
                  "var(--food-rose-gold)",
                ];
                const barColor = barColors[i % barColors.length];
                const pct = (c.avgRating / maxCuisineRating) * 100;
                return (
                  <div key={c.cuisine}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.25rem",
                      }}
                    >
                      <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--food-text)" }}>
                        {c.cuisine}
                      </span>
                      <span style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)" }}>
                        {c.avgRating.toFixed(1)} {"★"} ({c.count} meals)
                      </span>
                    </div>
                    <div
                      style={{
                        height: "0.75rem",
                        borderRadius: "0.375rem",
                        background: "rgba(244, 114, 182, 0.08)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          borderRadius: "0.375rem",
                          background: barColor,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Most Loved Recipes */}
      {data.topRecipes && data.topRecipes.length > 0 && (
        <section
          className="food-enter"
          style={{ marginBottom: "2rem", "--enter-delay": "0.3s" } as React.CSSProperties}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            {"❤️"} Most Loved Recipes
          </h2>
          <div className="food-card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {data.topRecipes.map((recipe, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 1rem",
                    borderRadius: "0.75rem",
                    background: "rgba(244, 114, 182, 0.04)",
                    border: "1px solid var(--food-border)",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--food-text)", fontSize: "0.9375rem" }}>
                      {recipe.title}
                    </span>
                    <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)", marginTop: "0.125rem" }}>
                      Cooked {recipe.timesCooked}x
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.125rem" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`food-star${star <= recipe.rating ? " filled" : ""}`}
                        style={{ cursor: "default", fontSize: "1rem" }}
                      >
                        {"★"}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Patterns */}
      {data.avoidPatterns && data.avoidPatterns.length > 0 && (
        <section
          className="food-enter"
          style={{ marginBottom: "2rem", "--enter-delay": "0.4s" } as React.CSSProperties}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            {"🔍"} Patterns
          </h2>
          <div className="food-card" style={{ padding: "1.25rem" }}>
            <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {data.avoidPatterns.map((p, i) => (
                <li key={i} style={{ color: "var(--food-text)", lineHeight: 1.5 }}>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Kid-friendly success rate */}
      {data.kidFriendlySuccessRate !== undefined && data.kidFriendlySuccessRate >= 0 && (
        <section
          className="food-enter"
          style={{ marginBottom: "2rem", "--enter-delay": "0.5s" } as React.CSSProperties}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            {"👶"} Kid-Friendly Success Rate
          </h2>
          <div className="food-card" style={{ padding: "1.5rem", textAlign: "center" }}>
            <div
              style={{
                fontSize: "3rem",
                fontWeight: 700,
                color: data.kidFriendlySuccessRate >= 75 ? "var(--food-mint)" : data.kidFriendlySuccessRate >= 50 ? "var(--food-peach)" : "var(--food-pink)",
                marginBottom: "0.5rem",
              }}
            >
              {Math.round(data.kidFriendlySuccessRate)}%
            </div>
            <p style={{ color: "var(--food-text-secondary)", margin: 0, fontSize: "0.9375rem" }}>
              of kid-friendly recipes rated 4+ stars
            </p>
            <div
              style={{
                marginTop: "1rem",
                height: "0.5rem",
                borderRadius: "0.25rem",
                background: "rgba(244, 114, 182, 0.08)",
                maxWidth: "300px",
                margin: "1rem auto 0",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(data.kidFriendlySuccessRate, 100)}%`,
                  borderRadius: "0.25rem",
                  background: data.kidFriendlySuccessRate >= 75 ? "var(--food-mint)" : data.kidFriendlySuccessRate >= 50 ? "var(--food-peach)" : "var(--food-pink)",
                  transition: "width 0.8s ease",
                }}
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
