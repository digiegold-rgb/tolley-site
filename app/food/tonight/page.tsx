"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Suggestion {
  title: string;
  description: string;
  estimatedTime: number;
  difficulty: string;
  kidFriendly: boolean;
  expiringItemsUsed?: string[];
  usesExpiring?: string[];
  recipeId?: string;
  slug?: string;
}

interface TonightResponse {
  suggestions: Suggestion[];
  expiringItems?: string[];
  expiring?: string[];
}

const CUISINES = [
  "Any",
  "American",
  "Italian",
  "Mexican",
  "Asian",
  "Mediterranean",
  "Indian",
  "Comfort Food",
];

export default function TonightPage() {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [quickOnly, setQuickOnly] = useState(false);
  const [cuisine, setCuisine] = useState("Any");
  const [expiringItems, setExpiringItems] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    fetch("/api/food/alerts")
      .then((r) => r.json())
      .then((data) => {
        const expiring = data.expiring || data.expiringItems;
        if (expiring) {
          setExpiringItems(expiring.map((i: any) => i.name || i));
        }
      })
      .catch(() => {});
  }, []);

  const fetchSuggestions = async () => {
    setLoading(true);
    setError("");
    setSuggestions([]);
    try {
      const res = await fetch("/api/food/tonight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quickOnly,
          cuisine: cuisine === "Any" ? undefined : cuisine,
        }),
      });
      if (!res.ok) throw new Error("Failed to get suggestions");
      const data: TonightResponse = await res.json();
      setSuggestions(data.suggestions || []);
      setExpiringItems(data.expiring || data.expiringItems || []);
      setHasFetched(true);
    } catch {
      setError("Couldn't get suggestions right now. Try again!");
    } finally {
      setLoading(false);
    }
  };

  const difficultyColor = (d: string) => {
    switch (d.toLowerCase()) {
      case "easy":
        return "food-tag-mint";
      case "medium":
        return "food-tag-peach";
      case "hard":
        return "food-tag-pink";
      default:
        return "food-tag-lavender";
    }
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Expiring items warning */}
      {expiringItems.length > 0 && (
        <div
          className="food-card food-enter"
          style={{
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            background: "rgba(239, 68, 68, 0.06)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "1.25rem" }}>{"⚠️"}</span>
            <strong className="food-expiry-urgent">Use it or lose it!</strong>
          </div>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--food-text-secondary)" }}>
            {expiringItems.slice(0, 5).join(", ")}
            {expiringItems.length > 5 && ` and ${expiringItems.length - 5} more`}
            {" "}expiring soon. Hit Surprise Me to use them up!
          </p>
        </div>
      )}

      {/* Hero */}
      <div
        className="food-enter"
        style={{ textAlign: "center", marginBottom: "2.5rem", "--enter-delay": "0.05s" } as React.CSSProperties}
      >
        <h1 style={{ fontSize: "2.25rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "0.5rem" }}>
          What's for dinner tonight? {"🍽️"}
        </h1>
        <p style={{ color: "var(--food-text-secondary)", fontSize: "1.0625rem", marginBottom: "2rem" }}>
          Let us figure it out based on what you have, what you love, and what needs using up.
        </p>

        {/* Filters */}
        <div
          className="food-enter"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem",
            marginBottom: "2rem",
            flexWrap: "wrap",
            "--enter-delay": "0.15s",
          } as React.CSSProperties}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              cursor: "pointer",
              fontSize: "0.9375rem",
              color: "var(--food-text)",
            }}
          >
            <input
              type="checkbox"
              className="food-check"
              checked={quickOnly}
              onChange={(e) => setQuickOnly(e.target.checked)}
            />
            Quick meals only (30 min or less)
          </label>

          <select
            className="food-input"
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            style={{ minWidth: "160px" }}
          >
            {CUISINES.map((c) => (
              <option key={c} value={c}>
                {c === "Any" ? "Any cuisine" : c}
              </option>
            ))}
          </select>
        </div>

        {/* Big button */}
        <button
          className="food-btn food-btn-primary food-glow food-enter"
          onClick={fetchSuggestions}
          disabled={loading}
          style={{
            fontSize: "1.375rem",
            padding: "1rem 2.5rem",
            borderRadius: "1rem",
            "--enter-delay": "0.25s",
          } as React.CSSProperties}
        >
          {loading ? "" : "🎲"} {loading ? "Thinking..." : "Surprise Me!"}
        </button>
      </div>

      {/* Loading animation */}
      {loading && (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div
            style={{
              fontSize: "3rem",
              animation: "food-fade-up 0.8s ease-in-out infinite alternate",
            }}
          >
            {"🧠"}
          </div>
          <p style={{ color: "var(--food-text-secondary)", marginTop: "0.75rem", fontSize: "1.0625rem" }}>
            Checking your pantry, preferences, and what's expiring...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="food-card"
          style={{ padding: "1.5rem", textAlign: "center", background: "rgba(239, 68, 68, 0.06)" }}
        >
          <p style={{ color: "#ef4444", fontWeight: 500 }}>{error}</p>
          <button className="food-btn food-btn-secondary" onClick={fetchSuggestions} style={{ marginTop: "0.75rem" }}>
            Try Again
          </button>
        </div>
      )}

      {/* Suggestion cards */}
      {suggestions.length > 0 && (
        <div
          className="food-enter"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "1.25rem",
            "--enter-delay": "0.1s",
          } as React.CSSProperties}
        >
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="food-card food-enter"
              style={{
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                "--enter-delay": `${0.15 + i * 0.1}s`,
              } as React.CSSProperties}
            >
              <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)", margin: 0 }}>
                {s.title}
              </h3>
              <p style={{ fontSize: "0.875rem", color: "var(--food-text-secondary)", margin: 0, lineHeight: 1.5 }}>
                {s.description}
              </p>

              {/* Meta badges */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                <span className={`food-tag ${difficultyColor(s.difficulty)}`}>{s.difficulty}</span>
                <span className="food-tag food-tag-lavender">{"⏱️"} {s.estimatedTime} min</span>
                {s.kidFriendly && <span className="food-tag food-tag-mint">{"👶"} Kid-Friendly</span>}
              </div>

              {/* Expiring items used */}
              {(s.expiringItemsUsed || s.usesExpiring || []).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                  {(s.expiringItemsUsed || s.usesExpiring || []).map((item) => (
                    <span key={item} className="food-tag food-tag-peach">
                      {"🔥"} Uses {item}
                    </span>
                  ))}
                </div>
              )}

              {/* Action button */}
              <div style={{ marginTop: "auto", paddingTop: "0.5rem" }}>
                {s.slug ? (
                  <Link
                    href={`/food/cook/${s.slug}`}
                    className="food-btn food-btn-primary"
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    {"🍳"} Let's Make This!
                  </Link>
                ) : (
                  <button
                    className="food-btn food-btn-primary"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => {
                      if (s.recipeId) {
                        window.location.href = `/food/recipes/${s.recipeId}`;
                      }
                    }}
                  >
                    {"🍳"} Let's Make This!
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Try again */}
      {hasFetched && suggestions.length > 0 && !loading && (
        <div
          className="food-enter"
          style={{ textAlign: "center", marginTop: "2rem", "--enter-delay": "0.4s" } as React.CSSProperties}
        >
          <button className="food-btn food-btn-secondary" onClick={fetchSuggestions}>
            {"🔄"} Try Again
          </button>
        </div>
      )}
    </div>
  );
}
