"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
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

type Phase = "ingredients" | "cooking" | "done";

export default function CookModePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Cook mode state
  const [phase, setPhase] = useState<Phase>("ingredients");
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [currentStep, setCurrentStep] = useState(0);

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rating state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Fetch recipe
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

  // Timer logic
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
    ? recipe.instructions.map((s) =>
        typeof s === "string" ? { text: s } : s
      )
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
      // still show confetti even if save fails
      setShowConfetti(true);
    } finally {
      setSaving(false);
    }
  };

  const totalTime = recipe
    ? (recipe.prepTime || 0) + (recipe.cookTime || 0)
    : 0;

  const progress =
    phase === "ingredients"
      ? 0
      : phase === "done"
        ? 100
        : steps.length > 0
          ? Math.round(((currentStep + 1) / steps.length) * 100)
          : 0;

  // Full-screen dark overlay style for cook mode
  const overlayStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "rgba(74, 32, 64, 0.95)",
    color: "white",
    padding: "1.5rem",
    position: "relative",
  };

  if (loading) {
    return (
      <div style={{ ...overlayStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem", animation: "food-fade-up 0.8s ease-in-out infinite alternate" }}>
            {"🍳"}
          </div>
          <p style={{ fontSize: "1.125rem", opacity: 0.8 }}>Loading recipe...</p>
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div style={{ ...overlayStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{"😕"}</div>
          <p style={{ fontSize: "1.125rem", marginBottom: "1.5rem" }}>{error || "Recipe not found"}</p>
          <Link href="/food/recipes" className="food-btn food-btn-secondary">
            Browse Recipes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle}>
      <FoodConfetti active={showConfetti} />

      {/* Progress bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: "rgba(255,255,255,0.15)",
          zIndex: 60,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "linear-gradient(90deg, var(--food-pink), var(--food-lavender))",
            transition: "width 0.4s ease",
            borderRadius: "0 2px 2px 0",
          }}
        />
      </div>

      {/* Header */}
      <div
        style={{
          maxWidth: "700px",
          margin: "0 auto",
          textAlign: "center",
          paddingTop: "1rem",
        }}
      >
        <Link
          href={`/food/recipes/${recipe.slug || recipe.id}`}
          style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none", fontSize: "0.8125rem" }}
        >
          {"← Back to recipe"}
        </Link>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            margin: "0.75rem 0 0.5rem",
            color: "var(--food-pink)",
          }}
        >
          {recipe.title}
        </h1>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "1.5rem",
            fontSize: "0.875rem",
            opacity: 0.7,
            marginBottom: "2rem",
          }}
        >
          {totalTime > 0 && <span>{"⏱️"} {totalTime} min</span>}
          {recipe.servings && <span>{"🍽️"} {recipe.servings} servings</span>}
        </div>
      </div>

      {/* Phase: Ingredients */}
      {phase === "ingredients" && (
        <div
          className="food-enter"
          style={{ maxWidth: "600px", margin: "0 auto" }}
        >
          <h2
            style={{
              fontSize: "1.375rem",
              fontWeight: 600,
              marginBottom: "1.5rem",
              textAlign: "center",
              color: "var(--food-mint)",
            }}
          >
            {"🥕"} Gather Your Ingredients
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              marginBottom: "2rem",
            }}
          >
            {(recipe.ingredients || []).map((ing, i) => (
              <label
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  cursor: "pointer",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.75rem",
                  background: checkedIngredients.has(i) ? "rgba(110, 231, 183, 0.12)" : "rgba(255,255,255,0.06)",
                  border: checkedIngredients.has(i) ? "1px solid rgba(110, 231, 183, 0.3)" : "1px solid rgba(255,255,255,0.1)",
                  transition: "all 0.2s",
                  fontSize: "1.125rem",
                  opacity: checkedIngredients.has(i) ? 0.6 : 1,
                  textDecoration: checkedIngredients.has(i) ? "line-through" : "none",
                }}
              >
                <input
                  type="checkbox"
                  className="food-check"
                  checked={checkedIngredients.has(i)}
                  onChange={() => toggleIngredient(i)}
                />
                <span>
                  {ing.quantity && (
                    <strong style={{ color: "var(--food-peach)" }}>
                      {ing.quantity} {ing.unit || ""}{" "}
                    </strong>
                  )}
                  {ing.name}
                  {ing.notes && (
                    <span style={{ opacity: 0.6, fontSize: "0.875rem" }}>
                      {" "}({ing.notes})
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
          <div style={{ textAlign: "center" }}>
            <button
              className="food-btn food-btn-primary food-glow"
              onClick={() => {
                setPhase("cooking");
                setCurrentStep(0);
              }}
              style={{ fontSize: "1.25rem", padding: "1rem 2.5rem", borderRadius: "1rem" }}
            >
              {"🔥"} Start Cooking
            </button>
          </div>
        </div>
      )}

      {/* Phase: Step-by-step cooking */}
      {phase === "cooking" && currentStepData && (
        <div
          className="food-enter"
          style={{ maxWidth: "650px", margin: "0 auto", textAlign: "center" }}
        >
          {/* Step counter */}
          <p
            style={{
              fontSize: "0.9375rem",
              color: "var(--food-lavender)",
              fontWeight: 500,
              marginBottom: "0.5rem",
            }}
          >
            Step {currentStep + 1} of {steps.length}
          </p>

          {/* Instruction text */}
          <div
            style={{
              padding: "2rem 1.5rem",
              borderRadius: "1rem",
              background: "rgba(255,255,255,0.06)",
              border: timerDone
                ? "2px solid var(--food-pink)"
                : "1px solid rgba(255,255,255,0.1)",
              marginBottom: "1.5rem",
              animation: timerDone ? "food-btn-glow 1s ease-in-out infinite" : "none",
              transition: "border-color 0.3s",
            }}
          >
            <p
              style={{
                fontSize: "1.5rem",
                lineHeight: 1.6,
                fontWeight: 400,
                margin: 0,
              }}
            >
              {currentStepData.text}
            </p>
          </div>

          {/* Timer */}
          {currentStepData.duration && (
            <div style={{ marginBottom: "2rem" }}>
              <div
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: timerDone ? "var(--food-mint)" : timerSeconds < 60 && timerRunning ? "var(--food-peach)" : "white",
                  marginBottom: "0.75rem",
                }}
              >
                {timerDone ? "Time's up!" : formatTime(timerSeconds)}
              </div>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                {!timerRunning && !timerDone && (
                  <button
                    className="food-btn food-btn-mint"
                    onClick={startStepTimer}
                    style={{ fontSize: "1.0625rem", padding: "0.75rem 1.5rem" }}
                  >
                    {"▶"} Start Timer ({currentStepData.duration} min)
                  </button>
                )}
                {timerRunning && (
                  <button
                    className="food-btn food-btn-secondary"
                    onClick={() => setTimerRunning(false)}
                    style={{ fontSize: "1.0625rem", padding: "0.75rem 1.5rem" }}
                  >
                    {"⏸"} Pause
                  </button>
                )}
                {!timerRunning && timerSeconds > 0 && !timerDone && (
                  <button
                    className="food-btn food-btn-mint"
                    onClick={() => setTimerRunning(true)}
                    style={{ fontSize: "1.0625rem", padding: "0.75rem 1.5rem" }}
                  >
                    {"▶"} Resume
                  </button>
                )}
                {timerDone && (
                  <button
                    className="food-btn food-btn-mint"
                    onClick={() => {
                      setTimerDone(false);
                      nextStep();
                    }}
                    style={{ fontSize: "1.0625rem", padding: "0.75rem 1.5rem" }}
                  >
                    {"✓"} Done, Next Step
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <button
              className="food-btn food-btn-secondary"
              onClick={prevStep}
              disabled={currentStep === 0}
              style={{
                fontSize: "1.125rem",
                padding: "0.875rem 1.75rem",
                opacity: currentStep === 0 ? 0.4 : 1,
                minWidth: "150px",
              }}
            >
              {"← Previous"}
            </button>
            <button
              className="food-btn food-btn-primary"
              onClick={nextStep}
              style={{
                fontSize: "1.125rem",
                padding: "0.875rem 1.75rem",
                minWidth: "150px",
              }}
            >
              {currentStep === steps.length - 1 ? "Finish! 🎉" : "Next →"}
            </button>
          </div>
        </div>
      )}

      {/* Phase: Done */}
      {phase === "done" && (
        <div
          className="food-enter"
          style={{ maxWidth: "500px", margin: "0 auto", textAlign: "center" }}
        >
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>{"🎉"}</div>
          <h2
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--food-mint)",
              marginBottom: "0.5rem",
            }}
          >
            All Done!
          </h2>
          <p style={{ opacity: 0.7, marginBottom: "2rem" }}>
            How did {recipe.title} turn out?
          </p>

          {/* Star rating */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "0.5rem",
              marginBottom: "1.5rem",
            }}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`food-star${star <= (hoverRating || rating) ? " filled" : ""}`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                style={{ fontSize: "2.5rem", cursor: "pointer" }}
              >
                {"★"}
              </span>
            ))}
          </div>

          {/* Notes */}
          <textarea
            className="food-input"
            placeholder="Any notes? Tips for next time?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              resize: "vertical",
              marginBottom: "1.5rem",
              background: "rgba(255,255,255,0.1)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          />

          {/* Save button */}
          <button
            className="food-btn food-btn-primary food-glow"
            onClick={handleSave}
            disabled={rating === 0 || saving}
            style={{
              fontSize: "1.25rem",
              padding: "0.875rem 2rem",
              opacity: rating === 0 ? 0.5 : 1,
              marginBottom: "1rem",
            }}
          >
            {saving ? "Saving..." : "Save & Celebrate 🎊"}
          </button>

          {showConfetti && (
            <p
              className="food-enter"
              style={{ color: "var(--food-mint)", fontWeight: 600, fontSize: "1.125rem" }}
            >
              Saved! You're an amazing chef {"💖"}
            </p>
          )}

          <div style={{ marginTop: "1.5rem" }}>
            <Link
              href="/food"
              className="food-btn food-btn-secondary"
              style={{ color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.2)" }}
            >
              Back to Kitchen
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
