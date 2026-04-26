"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
  notes?: string;
}

interface Instruction {
  step: number;
  text: string;
  duration?: number;
}

interface Recipe {
  id: string;
  title: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  cuisine?: string;
  mealType: string[];
  prepTime?: number;
  cookTime?: number;
  servings: number;
  ingredients: Ingredient[];
  instructions: Instruction[];
  nutrition?: { calories?: number; protein?: number; carbs?: number; fat?: number; fiber?: number };
  tags: string[];
  rating?: number;
  timesCooked: number;
  aiGenerated: boolean;
  source?: string;
  createdAt: string;
}

const TAG_COLORS = ["food-tag-pink", "food-tag-lavender", "food-tag-mint", "food-tag-peach"];

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [cookRating, setCookRating] = useState(0);
  const [cookNotes, setCookNotes] = useState("");
  const [showRateModal, setShowRateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchRecipe = useCallback(async () => {
    try {
      const res = await fetch(`/api/food/recipes/${slug}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setRecipe(data.recipe || data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchRecipe();
  }, [fetchRecipe]);

  const handleCookComplete = async () => {
    if (!recipe || !cookRating) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/food/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incrementCook: true, cookRating, cookNotes }),
      });
      if (res.ok) {
        setShowRateModal(false);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        fetchRecipe();
        setCookRating(0);
        setCookNotes("");
      }
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", animation: "food-sparkle 1.5s ease-in-out infinite" }}>🍳</div>
        <p style={{ color: "var(--food-text-secondary)", marginTop: "1rem" }}>Loading recipe...</p>
      </div>
    );
  }

  if (notFound || !recipe) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🍽️</div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>
          Recipe Not Found
        </h1>
        <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem" }}>
          This recipe might have been removed or the link is incorrect.
        </p>
        <Link href="/food/recipes" className="food-btn food-btn-primary">
          Browse Recipes
        </Link>
      </div>
    );
  }

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Confetti */}
      {showConfetti && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200 }}>
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="food-confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                top: "-5%",
                background: ["var(--food-pink)", "var(--food-lavender)", "var(--food-mint)", "var(--food-peach)", "#fbbf24"][i % 5],
                animationDelay: `${Math.random() * 0.5}s`,
                width: `${6 + Math.random() * 6}px`,
                height: `${6 + Math.random() * 6}px`,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              }}
            />
          ))}
        </div>
      )}

      {/* Back link */}
      <Link
        href="/food/recipes"
        className="food-enter"
        style={{ color: "var(--food-pink)", textDecoration: "none", fontSize: "0.875rem", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "0.25rem", marginBottom: "1.5rem" }}
      >
        &larr; Back to Recipes
      </Link>

      {/* Hero image / placeholder */}
      <div
        className="food-card food-enter"
        style={{
          overflow: "hidden",
          marginBottom: "1.5rem",
          "--enter-delay": "0.1s",
        } as React.CSSProperties}
      >
        <div
          style={{
            height: "280px",
            background: recipe.imageUrl
              ? `url(${recipe.imageUrl}) center/cover`
              : "linear-gradient(135deg, #fce4ec, #f3e5f5, #e8eaf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {!recipe.imageUrl && <span style={{ fontSize: "5rem" }}>🍽️</span>}
        </div>
      </div>

      {/* Title & meta */}
      <div className="food-enter" style={{ marginBottom: "1.5rem", "--enter-delay": "0.15s" } as React.CSSProperties}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "0.5rem" }}>
              {recipe.title}
            </h1>
            {recipe.description && (
              <p style={{ color: "var(--food-text-secondary)", fontSize: "0.9375rem", marginBottom: "0.75rem" }}>
                {recipe.description}
              </p>
            )}
          </div>
          <button
            className="food-btn food-btn-primary food-glow"
            onClick={() => setShowRateModal(true)}
          >
            I Cooked This!
          </button>
        </div>

        {/* Meta info */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.875rem", color: "var(--food-text-secondary)", marginBottom: "0.75rem" }}>
          {recipe.prepTime && <span>Prep: {recipe.prepTime} min</span>}
          {recipe.cookTime && <span>Cook: {recipe.cookTime} min</span>}
          {totalTime > 0 && <span>Total: {totalTime} min</span>}
          <span>Serves {recipe.servings}</span>
          {recipe.timesCooked > 0 && <span>Cooked {recipe.timesCooked}x</span>}
        </div>

        {/* Rating */}
        {recipe.rating !== undefined && recipe.rating > 0 && (
          <div style={{ display: "flex", gap: "0.125rem", marginBottom: "0.75rem" }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`food-star${star <= Math.round(recipe.rating!) ? " filled" : ""}`}
                style={{ cursor: "default" }}
              >
                ★
              </span>
            ))}
            <span style={{ marginLeft: "0.5rem", fontSize: "0.8125rem", color: "var(--food-text-secondary)" }}>
              {recipe.rating.toFixed(1)}
            </span>
          </div>
        )}

        {/* Tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
          {recipe.cuisine && <span className="food-tag food-tag-lavender">{recipe.cuisine}</span>}
          {recipe.mealType.map((mt) => (
            <span key={mt} className="food-tag food-tag-pink">{mt}</span>
          ))}
          {recipe.tags.map((tag, i) => (
            <span key={tag} className={`food-tag ${TAG_COLORS[(i + 2) % TAG_COLORS.length]}`}>{tag}</span>
          ))}
          {recipe.aiGenerated && <span className="food-tag food-tag-peach">AI Generated</span>}
        </div>
      </div>

      {/* Two-column layout: Ingredients | Instructions */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(250px, 1fr) 2fr", gap: "1.5rem" }}>
        {/* Ingredients */}
        <div
          className="food-card food-enter"
          style={{ padding: "1.25rem", alignSelf: "start", "--enter-delay": "0.2s" } as React.CSSProperties}
        >
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            Ingredients
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {(recipe.ingredients as Ingredient[]).map((ing, i) => (
              <li key={i} style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", fontSize: "0.9375rem" }}>
                <span style={{ color: "var(--food-pink)", fontWeight: 600, minWidth: "fit-content" }}>
                  {ing.quantity} {ing.unit}
                </span>
                <span style={{ color: "var(--food-text)" }}>{ing.name}</span>
                {ing.notes && (
                  <span style={{ color: "var(--food-text-secondary)", fontSize: "0.8125rem", fontStyle: "italic" }}>
                    ({ing.notes})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Instructions */}
        <div
          className="food-card food-enter"
          style={{ padding: "1.25rem", "--enter-delay": "0.25s" } as React.CSSProperties}
        >
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            Instructions
          </h2>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
            {(recipe.instructions as Instruction[]).map((step, i) => (
              <li key={i} style={{ display: "flex", gap: "0.75rem" }}>
                <div
                  style={{
                    width: "2rem",
                    height: "2rem",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--food-pink), var(--food-lavender))",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    flexShrink: 0,
                  }}
                >
                  {step.step || i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "var(--food-text)", fontSize: "0.9375rem", lineHeight: 1.6, margin: 0 }}>
                    {step.text}
                  </p>
                  {step.duration && (
                    <span style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)", marginTop: "0.25rem", display: "inline-block" }}>
                      ~{step.duration} min
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Nutrition */}
      {recipe.nutrition && (
        <div
          className="food-card food-enter"
          style={{ padding: "1.25rem", marginTop: "1.5rem", "--enter-delay": "0.3s" } as React.CSSProperties}
        >
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            Nutrition per Serving
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
            {recipe.nutrition.calories !== undefined && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--food-pink)" }}>{recipe.nutrition.calories}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>Calories</div>
              </div>
            )}
            {recipe.nutrition.protein !== undefined && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--food-lavender)" }}>{recipe.nutrition.protein}g</div>
                <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>Protein</div>
              </div>
            )}
            {recipe.nutrition.carbs !== undefined && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--food-mint)" }}>{recipe.nutrition.carbs}g</div>
                <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>Carbs</div>
              </div>
            )}
            {recipe.nutrition.fat !== undefined && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--food-peach)" }}>{recipe.nutrition.fat}g</div>
                <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>Fat</div>
              </div>
            )}
            {recipe.nutrition.fiber !== undefined && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--food-rose-gold)" }}>{recipe.nutrition.fiber}g</div>
                <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>Fiber</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cook / Rate Modal */}
      {showRateModal && (
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
          onClick={(e) => { if (e.target === e.currentTarget) setShowRateModal(false); }}
        >
          <div className="food-card food-enter" style={{ maxWidth: "420px", width: "100%", padding: "2rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>
              How was it?
            </h2>
            <p style={{ color: "var(--food-text-secondary)", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
              Rate your cooking of {recipe.title}
            </p>

            {/* Star rating */}
            <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1rem" }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`food-star${star <= cookRating ? " filled" : ""}`}
                  onClick={() => setCookRating(star)}
                  style={{ fontSize: "1.75rem" }}
                >
                  ★
                </span>
              ))}
            </div>

            <textarea
              className="food-input"
              placeholder="Any notes? (optional)"
              value={cookNotes}
              onChange={(e) => setCookNotes(e.target.value)}
              rows={3}
              style={{ width: "100%", resize: "vertical", marginBottom: "1rem" }}
            />

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="food-btn food-btn-secondary" onClick={() => setShowRateModal(false)}>
                Cancel
              </button>
              <button
                className="food-btn food-btn-primary"
                onClick={handleCookComplete}
                disabled={!cookRating || submitting}
                style={{ opacity: !cookRating || submitting ? 0.6 : 1 }}
              >
                {submitting ? "Saving..." : "Log It!"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
