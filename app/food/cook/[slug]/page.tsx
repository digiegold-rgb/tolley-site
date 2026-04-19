"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FoodConfetti } from "@/components/food/food-confetti";

interface Ingredient {
  name: string;
  quantity?: string;
  unit?: string;
  notes?: string;
}

interface Step {
  text: string;
  duration?: number;
}

interface Recipe {
  id: string;
  title: string;
  slug: string;
  prepTime?: number | null;
  cookTime?: number | null;
  servings?: number | null;
  ingredients: Ingredient[];
  instructions: (string | Step)[];
}

const RECIPE_EMOJIS = ["🍝", "🌮", "🍲", "🥗", "🍕", "🍜", "🥘", "🍗", "🥧", "🍳"];
function recipeEmoji(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return RECIPE_EMOJIS[h % RECIPE_EMOJIS.length];
}

type Phase = "ingredients" | "cooking" | "done";

export default function CookModePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [phase, setPhase] = useState<Phase>("ingredients");
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(
    new Set(),
  );
  const [currentStep, setCurrentStep] = useState(0);

  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/food/recipes/${slug}`);
        if (res.status === 404) {
          setError("Recipe not found");
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error("Failed to load recipe");
        const data = await res.json();
        setRecipe(data.recipe || data);
      } catch {
        setError("Couldn't load the recipe. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            setTimerDone(true);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerRunning, timerSeconds]);

  const toggleIngredient = (idx: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const steps: Step[] = recipe
    ? recipe.instructions.map((s) => (typeof s === "string" ? { text: s } : s))
    : [];

  const currentStepData = steps[currentStep];

  const startStepTimer = useCallback(() => {
    if (currentStepData?.duration) {
      setTimerSeconds(currentStepData.duration * 60);
      setTimerRunning(true);
      setTimerDone(false);
    }
  }, [currentStepData]);

  const goToStep = (idx: number) => {
    setTimerRunning(false);
    setTimerDone(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCurrentStep(idx);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      goToStep(currentStep + 1);
    } else {
      setPhase("done");
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  };

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const handleSave = async () => {
    if (!recipe) return;
    setSaving(true);
    try {
      await fetch(`/api/food/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incrementCook: true,
          cookRating: rating,
          cookNotes: notes,
        }),
      });
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    } catch {
      setShowConfetti(true);
    } finally {
      setSaving(false);
    }
  };

  const totalTime = recipe ? (recipe.prepTime || 0) + (recipe.cookTime || 0) : 0;

  // Progress: ingredients=10%, cooking= up to 90% across steps, done=100%
  const progress =
    phase === "ingredients"
      ? 10
      : phase === "done"
        ? 100
        : steps.length > 0
          ? 10 + Math.round(((currentStep + 1) / steps.length) * 85)
          : 50;

  const overlayBase: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    background: "#3d1030",
    color: "white",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  };

  if (loading) {
    return (
      <div
        style={{
          ...overlayBase,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 48,
              marginBottom: 12,
              animation: "food-fade-up 0.8s ease-in-out infinite alternate",
            }}
          >
            🍳
          </div>
          <p
            style={{
              fontSize: 16,
              opacity: 0.8,
              fontFamily: "var(--font-sora), sans-serif",
            }}
          >
            Loading recipe...
          </p>
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div
        style={{
          ...overlayBase,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
          <p
            style={{
              fontSize: 16,
              marginBottom: 20,
              fontFamily: "var(--font-sora), sans-serif",
            }}
          >
            {error || "Recipe not found"}
          </p>
          <Link href="/food/recipes" className="food-btn food-btn-secondary">
            Browse Recipes
          </Link>
        </div>
      </div>
    );
  }

  const emoji = recipeEmoji(recipe.title);
  const timerWarning = timerRunning && timerSeconds > 0 && timerSeconds <= 30;

  return (
    <div style={overlayBase}>
      <FoodConfetti active={showConfetti} />

      {/* Progress bar */}
      <div
        style={{
          height: 4,
          background: "rgba(255,255,255,0.15)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background:
              "linear-gradient(90deg, var(--food-pink), var(--food-mint))",
            transition: "width 0.4s ease",
          }}
        />
      </div>

      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "14px 18px" }}
      >
        <button
          type="button"
          onClick={() => router.push(`/food/recipes/${recipe.slug}`)}
          aria-label="Close cook mode"
          className="cursor-pointer bg-transparent border-0"
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 22,
            padding: 0,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
        {phase === "cooking" ? (
          <span
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.6)",
              fontFamily: "var(--font-sora), sans-serif",
            }}
          >
            Step {currentStep + 1} of {steps.length}
          </span>
        ) : (
          <span
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.6)",
              fontFamily: "var(--font-sora), sans-serif",
            }}
          >
            {phase === "ingredients"
              ? "Prep"
              : phase === "done"
                ? "Done"
                : ""}
          </span>
        )}
        <span aria-hidden="true" style={{ fontSize: 22 }}>
          {emoji}
        </span>
      </div>

      {/* PHASE: Ingredients */}
      {phase === "ingredients" && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "8px 18px 18px",
            maxWidth: 600,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <p
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.5)",
              marginBottom: 6,
              textAlign: "center",
              fontFamily: "var(--font-sora), sans-serif",
            }}
          >
            {recipe.title}
          </p>
          <h2
            style={{
              fontFamily: "var(--font-fredoka), system-ui, sans-serif",
              fontSize: 22,
              fontWeight: 600,
              color: "white",
              margin: "0 0 16px",
              textAlign: "center",
            }}
          >
            🥕 Gather your ingredients
          </h2>
          {totalTime > 0 || recipe.servings ? (
            <div
              className="flex justify-center"
              style={{
                gap: 14,
                fontSize: 13,
                color: "rgba(255,255,255,0.7)",
                marginBottom: 18,
                fontFamily: "var(--font-sora), sans-serif",
              }}
            >
              {totalTime > 0 && <span>⏱ {totalTime} min</span>}
              {recipe.servings && <span>🍽 {recipe.servings}</span>}
            </div>
          ) : null}
          <div
            className="flex flex-col"
            style={{ gap: 8, marginBottom: 24 }}
          >
            {(recipe.ingredients || []).map((ing, i) => {
              const checked = checkedIngredients.has(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleIngredient(i)}
                  className="cursor-pointer text-left"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: checked
                      ? "rgba(110,231,183,0.12)"
                      : "rgba(255,255,255,0.06)",
                    border: checked
                      ? "1px solid rgba(110,231,183,0.35)"
                      : "1px solid rgba(255,255,255,0.12)",
                    transition: "all 0.2s",
                    opacity: checked ? 0.6 : 1,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: "2px solid var(--food-mint)",
                      background: checked ? "var(--food-mint)" : "transparent",
                      color: "white",
                      fontSize: 14,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      color: "white",
                      fontFamily: "var(--font-sora), sans-serif",
                      textDecoration: checked ? "line-through" : "none",
                    }}
                  >
                    {ing.quantity && (
                      <strong style={{ color: "var(--food-peach)" }}>
                        {ing.quantity} {ing.unit || ""}{" "}
                      </strong>
                    )}
                    {ing.name}
                    {ing.notes && (
                      <span style={{ opacity: 0.6, fontSize: 13 }}>
                        {" "}({ing.notes})
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              setPhase("cooking");
              setCurrentStep(0);
            }}
            className="cursor-pointer"
            style={{
              padding: "14px 20px",
              borderRadius: 14,
              background:
                "linear-gradient(135deg, var(--food-pink), var(--food-lavender))",
              color: "white",
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "var(--font-fredoka), system-ui, sans-serif",
              border: "none",
              boxShadow: "0 4px 16px rgba(244,114,182,0.4)",
            }}
          >
            🔥 Start Cooking →
          </button>
        </div>
      )}

      {/* PHASE: Cooking step */}
      {phase === "cooking" && currentStepData && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "8px 18px 18px",
            maxWidth: 600,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <p
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.5)",
              marginBottom: 12,
              textAlign: "center",
              fontFamily: "var(--font-sora), sans-serif",
            }}
          >
            {recipe.title}
          </p>

          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 0",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                fontSize: 22,
                fontWeight: 600,
                color: "white",
                lineHeight: 1.5,
                textAlign: "center",
                margin: 0,
              }}
            >
              {currentStepData.text}
            </p>
          </div>

          {/* Timer */}
          {currentStepData.duration ? (
            <div style={{ marginBottom: 14 }}>
              {!timerRunning && timerSeconds === 0 && !timerDone && (
                <button
                  type="button"
                  onClick={startStepTimer}
                  className="cursor-pointer"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.10)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "rgba(255,255,255,0.8)",
                    fontSize: 14,
                    fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                  }}
                >
                  ⏱ Start {currentStepData.duration}:00 timer
                </button>
              )}
              {(timerRunning || (timerSeconds > 0 && !timerDone)) && (
                <div
                  className="flex items-center justify-between"
                  style={{
                    padding: "14px 20px",
                    borderRadius: 16,
                    background: timerWarning
                      ? "rgba(239,68,68,0.25)"
                      : "rgba(255,255,255,0.12)",
                    border: timerWarning
                      ? "1px solid rgba(239,68,68,0.4)"
                      : "1px solid rgba(255,255,255,0.2)",
                    animation: timerWarning
                      ? "food-timer-pulse 1s ease-in-out infinite"
                      : "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-sora), sans-serif",
                      fontWeight: 700,
                      fontSize: 32,
                      color: "white",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ⏱ {formatTime(timerSeconds)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTimerRunning((r) => !r)}
                    className="cursor-pointer"
                    style={{
                      padding: "8px 16px",
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.20)",
                      color: "white",
                      fontSize: 14,
                      fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                      border: "none",
                    }}
                  >
                    {timerRunning ? "⏸ Pause" : "▶ Resume"}
                  </button>
                </div>
              )}
              {timerDone && (
                <div
                  style={{
                    padding: "14px 20px",
                    borderRadius: 16,
                    background: "rgba(110,231,183,0.20)",
                    border: "1px solid rgba(110,231,183,0.4)",
                    color: "var(--food-mint)",
                    textAlign: "center",
                    fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  ⏰ Time&rsquo;s up!
                </div>
              )}
            </div>
          ) : null}

          {/* Navigation */}
          <div className="flex" style={{ gap: 10 }}>
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="cursor-pointer"
              style={{
                flex: 1,
                padding: "14px 16px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "white",
                fontSize: 16,
                fontWeight: 600,
                fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                opacity: currentStep === 0 ? 0.4 : 1,
              }}
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={nextStep}
              className="cursor-pointer"
              style={{
                flex: 2,
                padding: "14px 16px",
                borderRadius: 14,
                background:
                  currentStep === steps.length - 1
                    ? "linear-gradient(135deg, #6ee7b7, #34d399)"
                    : "linear-gradient(135deg, var(--food-pink), var(--food-lavender))",
                color: "white",
                fontSize: 16,
                fontWeight: 700,
                fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                border: "none",
                boxShadow:
                  currentStep === steps.length - 1
                    ? "0 4px 16px rgba(110,231,183,0.4)"
                    : "0 4px 16px rgba(244,114,182,0.4)",
              }}
            >
              {currentStep === steps.length - 1 ? "Done! 🎉" : "Next Step →"}
            </button>
          </div>
        </div>
      )}

      {/* PHASE: Done */}
      {phase === "done" && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "20px 18px",
            maxWidth: 480,
            margin: "0 auto",
            width: "100%",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 12 }}>🎉</div>
          <h2
            style={{
              fontFamily: "var(--font-fredoka), system-ui, sans-serif",
              fontSize: 26,
              fontWeight: 700,
              color: "var(--food-mint)",
              margin: "0 0 6px",
            }}
          >
            All Done!
          </h2>
          <p
            style={{
              opacity: 0.75,
              marginBottom: 20,
              fontFamily: "var(--font-sora), sans-serif",
              fontSize: 14,
            }}
          >
            How did {recipe.title} turn out?
          </p>

          <div
            className="flex justify-center"
            style={{ gap: 8, marginBottom: 16 }}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`food-star${star <= (hoverRating || rating) ? " filled" : ""}`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                style={{ fontSize: 36, cursor: "pointer" }}
              >
                ★
              </span>
            ))}
          </div>

          <textarea
            placeholder="Any notes? Tips for next time?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              resize: "vertical",
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.10)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.2)",
              fontSize: 14,
              fontFamily: "var(--font-sora), sans-serif",
              outline: "none",
            }}
          />

          <button
            type="button"
            onClick={handleSave}
            disabled={rating === 0 || saving}
            className="cursor-pointer"
            style={{
              padding: "14px 20px",
              borderRadius: 14,
              background:
                "linear-gradient(135deg, var(--food-pink), var(--food-lavender))",
              color: "white",
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "var(--font-fredoka), system-ui, sans-serif",
              border: "none",
              boxShadow: "0 4px 16px rgba(244,114,182,0.4)",
              opacity: rating === 0 || saving ? 0.5 : 1,
              marginBottom: 12,
            }}
          >
            {saving ? "Saving..." : "Save & Celebrate 🎊"}
          </button>

          {showConfetti && (
            <p
              style={{
                color: "var(--food-mint)",
                fontWeight: 600,
                fontSize: 16,
                fontFamily: "var(--font-fredoka), system-ui, sans-serif",
              }}
            >
              Saved! You&rsquo;re an amazing chef 💖
            </p>
          )}

          <Link
            href="/food"
            className="food-btn food-btn-secondary"
            style={{
              color: "rgba(255,255,255,0.8)",
              borderColor: "rgba(255,255,255,0.2)",
              background: "transparent",
              marginTop: 16,
              display: "inline-block",
            }}
          >
            Back to Kitchen
          </Link>
        </div>
      )}
    </div>
  );
}
