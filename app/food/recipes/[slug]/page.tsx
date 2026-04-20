"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { FoodAddToPlanModal } from "@/components/food/food-add-to-plan-modal";

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
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
  };
  tags: string[];
  rating?: number;
  timesCooked: number;
  aiGenerated: boolean;
  source?: string;
  createdAt: string;
}

const RECIPE_EMOJIS = [
  "🍝",
  "🌮",
  "🍲",
  "🥗",
  "🍕",
  "🍜",
  "🥘",
  "🍗",
  "🥧",
  "🍳",
];
function recipeEmoji(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return RECIPE_EMOJIS[h % RECIPE_EMOJIS.length];
}

function tagColor(tag: string): string {
  const t = tag.toLowerCase();
  if (/dinner|italian|mexican|comfort|breakfast/.test(t)) return "food-tag-pink";
  if (/healthy|quick|vegan|veg/.test(t)) return "food-tag-mint";
  if (/dessert|budget|sweet/.test(t)) return "food-tag-peach";
  if (/lunch|snack/.test(t)) return "food-tag-lavender";
  return "food-tag-lavender";
}

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
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"ingredients" | "steps">("ingredients");
  const [groceryStatus, setGroceryStatus] = useState<
    "idle" | "adding" | "added" | "error"
  >("idle");

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

  const handleAddAllToGrocery = async () => {
    if (!recipe || groceryStatus === "adding") return;
    setGroceryStatus("adding");
    try {
      const listsRes = await fetch("/api/food/groceries");
      if (!listsRes.ok) throw new Error("lists fetch failed");
      const { lists } = await listsRes.json();
      const active =
        (lists as { id: string; status: string }[]).find(
          (l) => l.status === "active",
        ) ?? null;

      let listId = active?.id ?? null;
      if (!listId) {
        const createRes = await fetch("/api/food/groceries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ store: "Shopping List" }),
        });
        if (!createRes.ok) throw new Error("create list failed");
        const { list } = await createRes.json();
        listId = list.id;
      }

      const items = recipe.ingredients.map((ing) => ({
        name: ing.name,
        quantity: parseFloat(ing.quantity) || 1,
        unit: ing.unit || undefined,
      }));

      const addRes = await fetch("/api/food/groceries/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId, items }),
      });
      if (!addRes.ok) throw new Error("add items failed");
      setGroceryStatus("added");
      setTimeout(() => setGroceryStatus("idle"), 2500);
    } catch {
      setGroceryStatus("error");
      setTimeout(() => setGroceryStatus("idle"), 3000);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          background: "var(--food-bg-warm)",
          minHeight: "100vh",
          padding: "4rem 1.5rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "2.5rem",
            animation: "food-sparkle 1.5s ease-in-out infinite",
          }}
        >
          🍳
        </div>
        <p style={{ color: "var(--food-text-secondary)", marginTop: "1rem" }}>
          Loading recipe...
        </p>
      </div>
    );
  }

  if (notFound || !recipe) {
    return (
      <div
        style={{
          background: "var(--food-bg-warm)",
          minHeight: "100vh",
          padding: "4rem 1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🍽️</div>
        <h1
          style={{
            fontFamily: "var(--font-fredoka), system-ui, sans-serif",
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--food-text)",
            marginBottom: "0.5rem",
          }}
        >
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
  const emoji = recipeEmoji(recipe.title);

  return (
    <div style={{ background: "var(--food-bg-warm)", minHeight: "100vh" }}>
      {showConfetti && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 200,
          }}
        >
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="food-confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                top: "-5%",
                background: [
                  "var(--food-pink)",
                  "var(--food-lavender)",
                  "var(--food-mint)",
                  "var(--food-peach)",
                  "#fbbf24",
                ][i % 5],
                animationDelay: `${Math.random() * 0.5}s`,
                width: `${6 + Math.random() * 6}px`,
                height: `${6 + Math.random() * 6}px`,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              }}
            />
          ))}
        </div>
      )}

      {/* Hero — gradient banner with emoji or recipe image */}
      <section
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #f472b6, #c084fc)",
          padding: "20px 20px 28px",
        }}
      >
        <div
          aria-hidden="true"
          className="absolute"
          style={{
            top: -30,
            right: -20,
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.12)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute"
          style={{
            bottom: -40,
            left: 30,
            width: 90,
            height: 90,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
          }}
        />

        <button
          type="button"
          onClick={() => router.back()}
          className="relative bg-transparent border-0 cursor-pointer"
          style={{
            color: "rgba(255,255,255,0.95)",
            fontSize: 14,
            fontFamily: "var(--font-sora), sans-serif",
            padding: 0,
            marginBottom: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ← Back
        </button>

        <div
          className="relative text-center"
          style={{ paddingTop: 8, paddingBottom: 4 }}
        >
          <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 8 }}>
            {recipe.imageUrl && !imageBroken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                onError={() => setImageBroken(true)}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 24,
                  objectFit: "cover",
                  display: "inline-block",
                  border: "3px solid rgba(255,255,255,0.5)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                }}
              />
            ) : (
              <span aria-hidden="true">{emoji}</span>
            )}
          </div>
          <h1
            className="text-white"
            style={{
              fontFamily: "var(--font-fredoka), system-ui, sans-serif",
              fontSize: 22,
              fontWeight: 700,
              margin: "0 0 8px",
              lineHeight: 1.2,
            }}
          >
            {recipe.title}
          </h1>
          <div
            className="flex flex-wrap justify-center"
            style={{
              gap: 10,
              fontFamily: "var(--font-sora), sans-serif",
              fontSize: 13,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {totalTime > 0 && <span>⏱ {totalTime} min</span>}
            <span>👤 {recipe.servings}</span>
            {recipe.nutrition?.calories !== undefined && (
              <span>🔥 {recipe.nutrition.calories} cal</span>
            )}
            {recipe.timesCooked > 0 && <span>🍳 {recipe.timesCooked}x</span>}
          </div>

          <div
            className="flex flex-wrap justify-center"
            style={{ gap: 6, marginTop: 12 }}
          >
            {recipe.cuisine && (
              <span
                style={{
                  background: "rgba(255,255,255,0.22)",
                  color: "white",
                  fontSize: 11,
                  padding: "4px 12px",
                  borderRadius: 9999,
                  fontFamily: "var(--font-sora), sans-serif",
                }}
              >
                {recipe.cuisine}
              </span>
            )}
            {recipe.mealType.slice(0, 2).map((mt) => (
              <span
                key={mt}
                style={{
                  background: "rgba(255,255,255,0.22)",
                  color: "white",
                  fontSize: 11,
                  padding: "4px 12px",
                  borderRadius: 9999,
                  fontFamily: "var(--font-sora), sans-serif",
                }}
              >
                {mt}
              </span>
            ))}
            {recipe.aiGenerated && (
              <span
                style={{
                  background: "rgba(255,255,255,0.22)",
                  color: "white",
                  fontSize: 11,
                  padding: "4px 12px",
                  borderRadius: 9999,
                  fontFamily: "var(--font-sora), sans-serif",
                }}
              >
                ✨ AI
              </span>
            )}
          </div>
        </div>
      </section>

      {recipe.description && (
        <p
          style={{
            color: "var(--food-text-secondary)",
            fontSize: 14,
            margin: "16px 16px 0",
            fontFamily: "var(--font-sora), sans-serif",
            lineHeight: 1.5,
          }}
        >
          {recipe.description}
        </p>
      )}

      {recipe.tags.length > 0 && (
        <div
          className="flex flex-wrap"
          style={{ gap: 6, margin: "12px 16px 0" }}
        >
          {recipe.tags.map((t) => (
            <span key={t} className={`food-tag ${tagColor(t)}`}>
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex"
        style={{ gap: 6, padding: "16px 16px 0" }}
      >
        {(["ingredients", "steps"] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="flex-1 cursor-pointer"
              style={{
                padding: "10px 0",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                border: "1.5px solid",
                borderColor: active
                  ? "var(--food-pink)"
                  : "var(--food-border)",
                background: active ? "var(--food-pink)" : "white",
                color: active ? "white" : "var(--food-text-secondary)",
              }}
            >
              {t === "ingredients" ? "Ingredients" : "Steps"}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ padding: "12px 16px 0" }}>
        {tab === "ingredients" ? (
          <div className="flex flex-col" style={{ gap: 10 }}>
            {recipe.ingredients.map((ing, i) => (
              <div
                key={i}
                className="flex items-center"
                style={{
                  gap: 12,
                  padding: "12px 14px",
                  background: "white",
                  border: "1px solid var(--food-border)",
                  borderRadius: 12,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 9999,
                    background:
                      "linear-gradient(135deg, var(--food-pink), var(--food-lavender))",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-sora), sans-serif",
                      fontSize: 14,
                      color: "var(--food-text)",
                    }}
                  >
                    {ing.quantity && (
                      <strong style={{ marginRight: 6 }}>
                        {ing.quantity} {ing.unit}
                      </strong>
                    )}
                    {ing.name}
                  </span>
                  {ing.notes && (
                    <span
                      style={{
                        fontFamily: "var(--font-sora), sans-serif",
                        fontSize: 12,
                        color: "var(--food-text-secondary)",
                        fontStyle: "italic",
                        marginLeft: 6,
                      }}
                    >
                      ({ing.notes})
                    </span>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddAllToGrocery}
              disabled={groceryStatus === "adding"}
              className="cursor-pointer"
              style={{
                marginTop: 6,
                padding: "11px 16px",
                background: "rgba(110,231,183,0.15)",
                border: "1px solid rgba(110,231,183,0.4)",
                color: "#047857",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                opacity: groceryStatus === "adding" ? 0.6 : 1,
              }}
            >
              {groceryStatus === "adding"
                ? "Adding…"
                : groceryStatus === "added"
                  ? "✓ Added to grocery list"
                  : groceryStatus === "error"
                    ? "Couldn’t add — try again"
                    : "🛒 Add all to grocery list"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: 10 }}>
            {recipe.instructions.map((step, i) => (
              <div
                key={i}
                className="flex"
                style={{
                  gap: 12,
                  padding: 14,
                  background: "white",
                  border: "1px solid var(--food-border)",
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9999,
                    background:
                      "linear-gradient(135deg, var(--food-pink), var(--food-lavender))",
                    color: "white",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {step.step || i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontFamily: "var(--font-sora), sans-serif",
                      fontSize: 13.5,
                      color: "var(--food-text)",
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    {step.text}
                  </p>
                  {step.duration && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--food-text-secondary)",
                        marginTop: 4,
                        display: "inline-block",
                        fontFamily: "var(--font-sora), sans-serif",
                      }}
                    >
                      ⏱ ~{step.duration} min
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Primary CTA — Start Cook Mode */}
      <div style={{ padding: "18px 16px 8px" }}>
        <Link
          href={`/food/cook/${recipe.slug}`}
          className="food-btn food-btn-primary food-glow"
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            fontSize: 16,
          }}
        >
          🍳 Start Cook Mode
        </Link>
      </div>

      {/* Secondary actions */}
      <div
        className="flex"
        style={{ padding: "0 16px", gap: 8 }}
      >
        <button
          type="button"
          onClick={() => setShowPlanModal(true)}
          className="food-btn food-btn-secondary cursor-pointer"
          style={{ flex: 1 }}
        >
          📅 Add to Plan
        </button>
        <button
          type="button"
          onClick={() => setShowRateModal(true)}
          className="food-btn food-btn-secondary cursor-pointer"
          style={{ flex: 1 }}
        >
          ⭐ I Cooked This
        </button>
      </div>

      {/* Nutrition */}
      {recipe.nutrition && (
        <div style={{ padding: "20px 16px 0" }}>
          <h2
            style={{
              fontFamily: "var(--font-fredoka), system-ui, sans-serif",
              fontSize: 16,
              fontWeight: 700,
              color: "var(--food-text)",
              margin: "0 0 10px",
            }}
          >
            Nutrition (per serving)
          </h2>
          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
              gap: 8,
              padding: 14,
              background: "white",
              border: "1px solid var(--food-border)",
              borderRadius: 16,
            }}
          >
            {recipe.nutrition.calories !== undefined && (
              <div className="text-center">
                <div
                  style={{
                    fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--food-pink)",
                  }}
                >
                  {recipe.nutrition.calories}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--food-text-secondary)",
                    fontFamily: "var(--font-sora), sans-serif",
                  }}
                >
                  Calories
                </div>
              </div>
            )}
            {recipe.nutrition.protein !== undefined && (
              <div className="text-center">
                <div
                  style={{
                    fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--food-lavender)",
                  }}
                >
                  {recipe.nutrition.protein}g
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--food-text-secondary)",
                    fontFamily: "var(--font-sora), sans-serif",
                  }}
                >
                  Protein
                </div>
              </div>
            )}
            {recipe.nutrition.carbs !== undefined && (
              <div className="text-center">
                <div
                  style={{
                    fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--food-mint)",
                  }}
                >
                  {recipe.nutrition.carbs}g
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--food-text-secondary)",
                    fontFamily: "var(--font-sora), sans-serif",
                  }}
                >
                  Carbs
                </div>
              </div>
            )}
            {recipe.nutrition.fat !== undefined && (
              <div className="text-center">
                <div
                  style={{
                    fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--food-peach)",
                  }}
                >
                  {recipe.nutrition.fat}g
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--food-text-secondary)",
                    fontFamily: "var(--font-sora), sans-serif",
                  }}
                >
                  Fat
                </div>
              </div>
            )}
            {recipe.nutrition.fiber !== undefined && (
              <div className="text-center">
                <div
                  style={{
                    fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--food-rose-gold)",
                  }}
                >
                  {recipe.nutrition.fiber}g
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--food-text-secondary)",
                    fontFamily: "var(--font-sora), sans-serif",
                  }}
                >
                  Fiber
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ height: 32 }} />

      {showPlanModal && recipe && (
        <FoodAddToPlanModal
          recipeId={recipe.id}
          recipeTitle={recipe.title}
          onClose={() => setShowPlanModal(false)}
        />
      )}

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
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRateModal(false);
          }}
        >
          <div
            className="food-card food-enter"
            style={{
              maxWidth: "420px",
              width: "100%",
              padding: "2rem",
              background: "white",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--food-text)",
                marginBottom: "0.5rem",
              }}
            >
              How was it?
            </h2>
            <p
              style={{
                color: "var(--food-text-secondary)",
                fontSize: "0.875rem",
                marginBottom: "1.25rem",
              }}
            >
              Rate your cooking of {recipe.title}
            </p>

            <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1rem" }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`food-star${star <= cookRating ? " filled" : ""}`}
                  onClick={() => setCookRating(star)}
                  style={{ fontSize: "1.75rem", cursor: "pointer" }}
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

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="food-btn food-btn-secondary"
                onClick={() => setShowRateModal(false)}
              >
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
