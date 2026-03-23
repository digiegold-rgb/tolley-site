"use client";

import { useState } from "react";

interface FoodRecipeDetailProps {
  recipe: any;
  onCookComplete: (rating: number, notes: string) => void;
}

export function FoodRecipeDetail({ recipe, onCookComplete }: FoodRecipeDetailProps) {
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [showCookModal, setShowCookModal] = useState(false);
  const [cookRating, setCookRating] = useState(0);
  const [cookNotes, setCookNotes] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleCookSubmit = () => {
    onCookComplete(cookRating, cookNotes);
    setShowCookModal(false);
    setCookRating(0);
    setCookNotes("");
  };

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
  const TAG_COLORS = ["food-tag-pink", "food-tag-lavender", "food-tag-mint", "food-tag-peach"];

  return (
    <div className="food-enter" style={{ padding: "2rem 1.5rem", maxWidth: "900px", margin: "0 auto" }}>
      {/* Header */}
      <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "0.5rem" }}>
        {recipe.title}
      </h1>

      {/* Meta row */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", fontSize: "0.875rem", color: "var(--food-text-secondary)" }}>
        {recipe.cuisine && <span className="food-tag food-tag-lavender">{recipe.cuisine}</span>}
        {recipe.prepTime && <span>🔪 Prep {recipe.prepTime} min</span>}
        {recipe.cookTime && <span>🔥 Cook {recipe.cookTime} min</span>}
        {totalTime > 0 && <span>⏱️ Total {totalTime} min</span>}
        {recipe.servings && <span>🍽️ {recipe.servings} servings</span>}
      </div>

      {/* Image */}
      {recipe.imageUrl && (
        <div style={{ borderRadius: "1rem", overflow: "hidden", marginBottom: "1.5rem" }}>
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            style={{ width: "100%", height: "300px", objectFit: "cover" }}
          />
        </div>
      )}

      {/* Description */}
      {recipe.description && (
        <p style={{ color: "var(--food-text-secondary)", lineHeight: 1.6, marginBottom: "2rem" }}>
          {recipe.description}
        </p>
      )}

      {/* Rating */}
      {recipe.rating !== undefined && recipe.rating > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <span style={{ fontSize: "0.875rem", color: "var(--food-text-secondary)" }}>Rating:</span>
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`food-star${star <= recipe.rating ? " filled" : ""}`}
              style={{ cursor: "default" }}
            >
              ★
            </span>
          ))}
        </div>
      )}

      {/* Ingredients */}
      <div className="food-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
          🥕 Ingredients
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {(recipe.ingredients || []).map((ing: any, i: number) => (
            <label
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                cursor: "pointer",
                textDecoration: checkedIngredients.has(i) ? "line-through" : "none",
                opacity: checkedIngredients.has(i) ? 0.5 : 1,
                transition: "opacity 0.2s",
              }}
            >
              <input
                type="checkbox"
                className="food-check"
                checked={checkedIngredients.has(i)}
                onChange={() => toggleIngredient(i)}
              />
              <span style={{ color: "var(--food-text)" }}>
                {ing.quantity && <strong>{ing.quantity} {ing.unit || ""} </strong>}
                {ing.name}
                {ing.notes && <span style={{ color: "var(--food-text-secondary)", fontSize: "0.8125rem" }}> ({ing.notes})</span>}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="food-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
          📝 Instructions
        </h2>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
          {(recipe.instructions || []).map((step: any, i: number) => (
            <li key={i} style={{ display: "flex", gap: "1rem" }}>
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
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: "var(--food-text)", lineHeight: 1.5 }}>
                  {typeof step === "string" ? step : step.text}
                </p>
                {step.duration && (
                  <span style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>
                    ⏱️ {step.duration} min
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Nutrition */}
      {recipe.nutrition && (
        <div className="food-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            📊 Nutrition
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "1rem" }}>
            {Object.entries(recipe.nutrition).map(([key, value]) => (
              <div key={key} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--food-pink)" }}>
                  {String(value)}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)", textTransform: "capitalize" }}>
                  {key}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {recipe.tags && recipe.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginBottom: "2rem" }}>
          {recipe.tags.map((tag: string, i: number) => (
            <span key={tag} className={`food-tag ${TAG_COLORS[i % TAG_COLORS.length]}`}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Cook button */}
      <button
        className="food-btn food-btn-primary food-glow"
        onClick={() => setShowCookModal(true)}
        style={{ fontSize: "1.125rem", padding: "0.875rem 2rem" }}
      >
        🍳 I Made This!
      </button>

      {/* Cook Modal */}
      {showCookModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCookModal(false); }}
        >
          <div
            className="food-card food-enter"
            style={{ padding: "2rem", maxWidth: "420px", width: "100%", background: "white" }}
          >
            <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
              How did it turn out? 🎉
            </h3>

            {/* Star rating */}
            <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1rem" }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`food-star${star <= (hoverRating || cookRating) ? " filled" : ""}`}
                  onClick={() => setCookRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{ fontSize: "1.75rem" }}
                >
                  ★
                </span>
              ))}
            </div>

            {/* Notes */}
            <textarea
              className="food-input"
              placeholder="Any notes? Tips? Changes you'd make?"
              value={cookNotes}
              onChange={(e) => setCookNotes(e.target.value)}
              rows={3}
              style={{ width: "100%", resize: "vertical", marginBottom: "1rem" }}
            />

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                className="food-btn food-btn-primary"
                onClick={handleCookSubmit}
                disabled={cookRating === 0}
                style={{ opacity: cookRating === 0 ? 0.5 : 1 }}
              >
                Save Cook Log
              </button>
              <button
                className="food-btn food-btn-secondary"
                onClick={() => setShowCookModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
