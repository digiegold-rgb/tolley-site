"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface MealSlot {
  id: string;
  day: number;
  mealType: string;
  recipeId?: string;
  recipe?: {
    id: string;
    title: string;
    slug: string;
    imageUrl?: string | null;
    cuisine?: string | null;
    prepTime?: number | null;
    cookTime?: number | null;
    ingredients?: any[];
    instructions?: any[];
    tags?: string[];
  };
  customMeal?: string;
  notes?: string;
}

interface MealPlan {
  id: string;
  weekStart: string;
  status: string;
  slots: MealSlot[];
}

interface RecipeOption {
  id: string;
  title: string;
  slug: string;
  cuisine?: string;
  mealType: string[];
}

interface GroceryPreview {
  name: string;
  quantity: number;
  unit?: string;
  aisle?: string;
  inPantry: boolean;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_EMOJI: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍪" };

function getWeekStart(offset: number = 0): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)} - ${end.toLocaleDateString("en-US", opts)}`;
}

export default function MealPlanPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  // Slot add modal
  const [editSlot, setEditSlot] = useState<{ day: number; mealType: string } | null>(null);
  const [slotMode, setSlotMode] = useState<"recipe" | "custom">("recipe");
  const [recipeSearch, setRecipeSearch] = useState("");
  const [recipeOptions, setRecipeOptions] = useState<RecipeOption[]>([]);
  const [customMeal, setCustomMeal] = useState("");
  const [savingSlot, setSavingSlot] = useState(false);

  // Recipe detail modal (click on filled slot)
  const [viewSlot, setViewSlot] = useState<MealSlot | null>(null);
  const [editingIngredients, setEditingIngredients] = useState<any[]>([]);

  // Grocery preview modal
  const [showGroceryPreview, setShowGroceryPreview] = useState(false);
  const [groceryPreview, setGroceryPreview] = useState<GroceryPreview[]>([]);
  const [generatingGroceries, setGeneratingGroceries] = useState(false);
  const [groceryGenerated, setGroceryGenerated] = useState(false);

  // History
  const [showHistory, setShowHistory] = useState(false);
  const [historyPlans, setHistoryPlans] = useState<MealPlan[]>([]);

  const weekStart = getWeekStart(weekOffset);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/food/plan?weekStart=${weekStart}`);
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan || null);
      }
    } catch {} finally { setLoading(false); }
  }, [weekStart]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  const searchRecipes = useCallback(async (query: string) => {
    try {
      const res = await fetch(`/api/food/recipes?search=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setRecipeOptions(data.recipes || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (editSlot) searchRecipes(recipeSearch);
  }, [editSlot, recipeSearch, searchRecipes]);

  const fetchHistory = useCallback(async () => {
    const weeks: MealPlan[] = [];
    for (let i = 1; i <= 4; i++) {
      try {
        const ws = getWeekStart(weekOffset - i);
        const res = await fetch(`/api/food/plan?weekStart=${ws}`);
        if (res.ok) { const d = await res.json(); if (d.plan) weeks.push(d.plan); }
      } catch {}
    }
    setHistoryPlans(weeks);
  }, [weekOffset]);

  useEffect(() => { if (showHistory) fetchHistory(); }, [showHistory, fetchHistory]);

  // ---- ACTIONS ----

  const handleCreatePlan = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/food/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weekStart }) });
      if (res.ok) fetchPlan();
    } catch {}
  };

  const handleAutoGenerate = async () => {
    if (!plan) return;
    setGenerating(true); setGenError("");
    try {
      const res = await fetch("/api/food/plan/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: plan.id }) });
      const data = await res.json();
      if (!res.ok) { setGenError(data.error || "Failed"); return; }
      fetchPlan();
    } catch { setGenError("Failed to connect"); } finally { setGenerating(false); }
  };

  const openSlotEditor = (day: number, mealType: string) => {
    setEditSlot({ day, mealType }); setSlotMode("recipe"); setRecipeSearch(""); setCustomMeal("");
  };

  const handleSelectRecipe = async (recipeId: string) => {
    if (!plan || !editSlot) return;
    setSavingSlot(true);
    try {
      await fetch("/api/food/plan/slots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: plan.id, day: editSlot.day, mealType: editSlot.mealType, recipeId }) });
      setEditSlot(null); fetchPlan();
    } catch {} finally { setSavingSlot(false); }
  };

  const handleSetCustomMeal = async () => {
    if (!plan || !editSlot || !customMeal.trim()) return;
    setSavingSlot(true);
    try {
      await fetch("/api/food/plan/slots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: plan.id, day: editSlot.day, mealType: editSlot.mealType, customMeal: customMeal.trim() }) });
      setEditSlot(null); fetchPlan();
    } catch {} finally { setSavingSlot(false); }
  };

  const handleRemoveSlot = async (slotId: string) => {
    try {
      await fetch(`/api/food/plan/slots?slotId=${slotId}`, { method: "DELETE" });
      fetchPlan();
    } catch {}
  };

  // ---- CLICK ON MEAL → VIEW RECIPE ----
  const handleSlotClick = async (slot: MealSlot) => {
    if (!slot.recipe) return;
    // Fetch full recipe detail
    try {
      const res = await fetch(`/api/food/recipes/${slot.recipe.id}`);
      if (res.ok) {
        const data = await res.json();
        const recipe = data.recipe || data;
        setViewSlot({ ...slot, recipe });
        setEditingIngredients(JSON.parse(JSON.stringify(recipe.ingredients || [])));
      }
    } catch {}
  };

  const handleSaveIngredients = async () => {
    if (!viewSlot?.recipe) return;
    try {
      await fetch(`/api/food/recipes/${viewSlot.recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: editingIngredients }),
      });
      fetchPlan();
      setViewSlot(null);
    } catch {}
  };

  // ---- GROCERY LIST WITH PANTRY CHECK ----
  const handleGenerateGroceryPreview = async () => {
    if (!plan) return;
    setGeneratingGroceries(true); setGroceryGenerated(false);

    // Collect all ingredients from all recipe slots
    const allIngredients: any[] = [];
    for (const slot of plan.slots) {
      if (slot.recipe?.ingredients) {
        for (const ing of slot.recipe.ingredients as any[]) {
          allIngredients.push({ name: ing.name, quantity: ing.quantity || 1, unit: ing.unit || "" });
        }
      }
    }

    // Fetch pantry
    let pantryItems: any[] = [];
    try {
      const res = await fetch("/api/food/pantry");
      if (res.ok) { const d = await res.json(); pantryItems = d.items || []; }
    } catch {}

    // Build pantry lookup
    const pantrySet = new Set(pantryItems.map((p: any) => (p.normalizedName || p.name).toLowerCase()));

    // Dedupe ingredients
    const merged = new Map<string, { name: string; quantity: number; unit: string }>();
    for (const ing of allIngredients) {
      const key = ing.name.toLowerCase().replace(/[^a-z ]/g, "").trim();
      const existing = merged.get(key);
      if (existing) { existing.quantity += ing.quantity || 1; }
      else merged.set(key, { name: ing.name, quantity: ing.quantity || 1, unit: ing.unit || "" });
    }

    // Mark pantry items
    const preview: GroceryPreview[] = [];
    for (const [key, item] of merged) {
      const inPantry = pantrySet.has(key) || [...pantrySet].some((p) => p.includes(key) || key.includes(p));
      preview.push({ name: item.name, quantity: item.quantity, unit: item.unit, inPantry });
    }

    // Sort: non-pantry first, then pantry (strikethrough)
    preview.sort((a, b) => (a.inPantry === b.inPantry ? 0 : a.inPantry ? 1 : -1));

    setGroceryPreview(preview);
    setShowGroceryPreview(true);
    setGeneratingGroceries(false);
  };

  const handleConfirmGroceryList = async () => {
    if (!plan) return;
    setGeneratingGroceries(true);
    try {
      // Create grocery list linked to plan
      const listRes = await fetch("/api/food/groceries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: plan.id, store: `Week of ${formatWeekRange(weekStart)}` }) });
      if (listRes.ok) {
        const listData = await listRes.json();
        const listId = listData.list?.id || listData.id;
        // Auto-generate items (this does the pantry subtraction server-side too)
        await fetch(`/api/food/groceries/${listId}/generate`, { method: "POST" });
        setGroceryGenerated(true);
      }
    } catch {} finally { setGeneratingGroceries(false); }
  };

  const getSlot = (day: number, mealType: string) => plan?.slots.find((s) => s.day === day && s.mealType === mealType);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div className="food-enter" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--food-text)" }}>Meal Plan</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button className="food-btn food-btn-secondary" onClick={() => setWeekOffset((o) => o - 1)} style={{ padding: "0.5rem 0.75rem" }}>&larr;</button>
          <div style={{ textAlign: "center", minWidth: 160 }}>
            <div style={{ fontWeight: 600, color: "var(--food-text)", fontSize: "0.9375rem" }}>
              {weekOffset === 0 ? "This Week" : weekOffset === 1 ? "Next Week" : weekOffset === -1 ? "Last Week" : formatWeekRange(weekStart)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>{formatWeekRange(weekStart)}</div>
          </div>
          <button className="food-btn food-btn-secondary" onClick={() => setWeekOffset((o) => o + 1)} style={{ padding: "0.5rem 0.75rem" }}>&rarr;</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <div style={{ fontSize: "2.5rem" }}>📅</div>
          <p style={{ color: "var(--food-text-secondary)", marginTop: "1rem" }}>Loading meal plan...</p>
        </div>
      ) : !plan ? (
        <div className="food-card" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📅</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>No meal plan for this week</h2>
          <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem" }}>Start planning your meals!</p>
          <button className="food-btn food-btn-primary food-glow" onClick={handleCreatePlan}>Start Planning</button>
        </div>
      ) : (
        <>
          {/* Action buttons */}
          <div className="food-enter" style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap", "--enter-delay": "0.1s" } as React.CSSProperties}>
            <button className="food-btn food-btn-primary food-glow" onClick={handleAutoGenerate} disabled={generating} style={{ opacity: generating ? 0.7 : 1 }}>
              {generating ? "Generating..." : "Auto-Plan Week"}
            </button>
            <button className="food-btn food-btn-mint" onClick={handleGenerateGroceryPreview} disabled={generatingGroceries}>
              {generatingGroceries ? "Checking pantry..." : "🛒 Generate Shopping List"}
            </button>
            <span className="food-tag food-tag-lavender" style={{ alignSelf: "center", padding: "0.375rem 0.75rem" }}>
              {plan.slots.filter((s) => s.recipeId || s.customMeal).length} meals planned
            </span>
          </div>

          {genError && (
            <div className="food-card" style={{ padding: "0.75rem 1rem", marginBottom: "1rem", borderColor: "var(--food-peach)", color: "#c2410c", fontSize: "0.875rem" }}>
              {genError}
            </div>
          )}

          {/* Calendar grid */}
          <div className="food-calendar food-enter" style={{ "--enter-delay": "0.15s" } as React.CSSProperties}>
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="food-day-col">
                <div className="food-day-header">{day}</div>
                {MEAL_TYPES.map((mt) => {
                  const slot = getSlot(dayIndex, mt);
                  return (
                    <div
                      key={mt}
                      className={`food-slot ${slot ? "filled" : ""}`}
                      onClick={() => slot?.recipe ? handleSlotClick(slot) : slot ? undefined : openSlotEditor(dayIndex, mt)}
                      style={{ cursor: slot?.recipe ? "pointer" : slot ? "default" : "pointer" }}
                    >
                      <div style={{ fontSize: "0.625rem", color: "var(--food-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.125rem" }}>
                        {MEAL_EMOJI[mt]} {mt}
                      </div>
                      {slot ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.125rem" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 500, color: slot.customMeal?.startsWith("*") ? "var(--food-lavender)" : "var(--food-text)", lineHeight: 1.3 }}>
                            {slot.recipe?.title || slot.customMeal || ""}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveSlot(slot.id); }}
                            style={{ background: "none", border: "none", color: "var(--food-text-secondary)", cursor: "pointer", fontSize: "0.75rem", padding: 0, flexShrink: 0 }}
                          >&times;</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.6875rem", color: "var(--food-border)" }}>+ Add</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* History toggle */}
          <div style={{ marginTop: "2rem", textAlign: "center" }}>
            <button className="food-btn food-btn-secondary" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? "Hide Past Weeks" : "📅 View Past Weeks"}
            </button>
          </div>

          {showHistory && (
            <div style={{ marginTop: "1.5rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>Past Meal Plans</h2>
              {historyPlans.length === 0 ? (
                <div className="food-card" style={{ padding: "1.5rem", textAlign: "center", color: "var(--food-text-secondary)" }}>
                  No past plans yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {historyPlans.map((hp) => (
                    <div key={hp.id} className="food-card" style={{ padding: "1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                        <span style={{ fontWeight: 600, color: "var(--food-text)" }}>{formatWeekRange(hp.weekStart)}</span>
                        <span className="food-tag food-tag-lavender">{hp.slots.length} meals</span>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {DAYS.map((dayName, dayIdx) => {
                          const dinner = hp.slots.find((s) => s.day === dayIdx && s.mealType === "dinner");
                          return (
                            <div key={dayIdx} style={{ flex: "1 1 0", minWidth: 90, padding: "0.5rem", borderRadius: "0.5rem", background: dinner ? "rgba(244,114,182,0.06)" : "rgba(0,0,0,0.02)", textAlign: "center" }}>
                              <div style={{ fontSize: "0.625rem", color: "var(--food-text-secondary)", fontWeight: 600, marginBottom: "0.125rem" }}>{dayName.slice(0, 3)}</div>
                              <div style={{ fontSize: "0.6875rem", color: "var(--food-text)", fontWeight: 500 }}>{dinner?.recipe?.title || dinner?.customMeal || "—"}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== SLOT ADD MODAL ===== */}
      {editSlot && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }} onClick={(e) => { if (e.target === e.currentTarget) setEditSlot(null); }}>
          <div className="food-card" style={{ maxWidth: 480, width: "100%", padding: "1.5rem", maxHeight: "80vh", overflow: "auto" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.25rem" }}>
              {DAYS[editSlot.day]} — {editSlot.mealType.charAt(0).toUpperCase() + editSlot.mealType.slice(1)}
            </h2>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", marginTop: "0.75rem" }}>
              <button className={`food-tab ${slotMode === "recipe" ? "active" : ""}`} onClick={() => setSlotMode("recipe")}>Pick Recipe</button>
              <button className={`food-tab ${slotMode === "custom" ? "active" : ""}`} onClick={() => setSlotMode("custom")}>Custom</button>
            </div>
            {slotMode === "recipe" ? (
              <div>
                <input className="food-input" placeholder="Search recipes..." value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} style={{ width: "100%", marginBottom: "0.75rem" }} />
                <div style={{ maxHeight: 250, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {recipeOptions.length === 0 ? (
                    <p style={{ color: "var(--food-text-secondary)", fontSize: "0.8125rem", textAlign: "center", padding: "1rem" }}>Type to search</p>
                  ) : recipeOptions.map((r) => (
                    <button key={r.id} onClick={() => handleSelectRecipe(r.id)} disabled={savingSlot} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--food-border)", background: "white", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "var(--font-fredoka), sans-serif" }}>
                      <span style={{ fontWeight: 500, color: "var(--food-text)", fontSize: "0.875rem" }}>{r.title}</span>
                      {r.cuisine && <span className="food-tag food-tag-lavender" style={{ marginLeft: "auto" }}>{r.cuisine}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <input className="food-input" placeholder="e.g. Leftovers, Eating out..." value={customMeal} onChange={(e) => setCustomMeal(e.target.value)} style={{ width: "100%", marginBottom: "0.75rem" }} />
                <button className="food-btn food-btn-primary" onClick={handleSetCustomMeal} disabled={!customMeal.trim() || savingSlot}>Add Meal</button>
              </div>
            )}
            <button className="food-btn food-btn-secondary" onClick={() => setEditSlot(null)} style={{ marginTop: "1rem", width: "100%" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ===== RECIPE DETAIL MODAL (click on a planned meal) ===== */}
      {viewSlot?.recipe && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }} onClick={(e) => { if (e.target === e.currentTarget) setViewSlot(null); }}>
          <div className="food-card" style={{ maxWidth: 600, width: "100%", padding: "1.5rem", maxHeight: "85vh", overflow: "auto" }}>
            {/* Recipe header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--food-text)" }}>{viewSlot.recipe.title}</h2>
              <button onClick={() => setViewSlot(null)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "var(--food-text-secondary)" }}>&times;</button>
            </div>
            <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              {viewSlot.recipe.cuisine && <span className="food-tag food-tag-lavender">{viewSlot.recipe.cuisine}</span>}
              {((viewSlot.recipe.prepTime || 0) + (viewSlot.recipe.cookTime || 0)) > 0 && <span className="food-tag food-tag-mint">⏱ {(viewSlot.recipe.prepTime || 0) + (viewSlot.recipe.cookTime || 0)} min</span>}
              <span className="food-tag food-tag-pink">{DAYS[viewSlot.day]} {viewSlot.mealType}</span>
            </div>

            {viewSlot.recipe.imageUrl && (
              <div style={{ borderRadius: "0.75rem", overflow: "hidden", marginBottom: "1rem", height: 180, background: `url(${viewSlot.recipe.imageUrl}) center/cover` }} />
            )}

            {/* Editable ingredients */}
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.75rem" }}>
              Ingredients
              <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--food-text-secondary)", marginLeft: "0.5rem" }}>(tap to edit)</span>
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "1rem" }}>
              {editingIngredients.map((ing: any, idx: number) => (
                <div key={idx} style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                  <input
                    className="food-input"
                    value={ing.quantity || ""}
                    onChange={(e) => { const copy = [...editingIngredients]; copy[idx] = { ...copy[idx], quantity: parseFloat(e.target.value) || 0 }; setEditingIngredients(copy); }}
                    style={{ width: 55, textAlign: "center", padding: "0.375rem" }}
                    type="number"
                    step="0.25"
                  />
                  <input
                    className="food-input"
                    value={ing.unit || ""}
                    onChange={(e) => { const copy = [...editingIngredients]; copy[idx] = { ...copy[idx], unit: e.target.value }; setEditingIngredients(copy); }}
                    style={{ width: 60, padding: "0.375rem" }}
                    placeholder="unit"
                  />
                  <input
                    className="food-input"
                    value={ing.name || ""}
                    onChange={(e) => { const copy = [...editingIngredients]; copy[idx] = { ...copy[idx], name: e.target.value }; setEditingIngredients(copy); }}
                    style={{ flex: 1, padding: "0.375rem" }}
                  />
                  <button onClick={() => setEditingIngredients(editingIngredients.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1.125rem", padding: 0 }}>&times;</button>
                </div>
              ))}
              <button
                onClick={() => setEditingIngredients([...editingIngredients, { name: "", quantity: 1, unit: "" }])}
                style={{ alignSelf: "flex-start", background: "none", border: "1.5px dashed var(--food-border)", borderRadius: "0.5rem", padding: "0.375rem 0.75rem", color: "var(--food-pink)", cursor: "pointer", fontSize: "0.8125rem", fontFamily: "var(--font-fredoka), sans-serif" }}
              >
                + Add Ingredient
              </button>
            </div>

            {/* Instructions preview */}
            {viewSlot.recipe.instructions && (viewSlot.recipe.instructions as any[]).length > 0 && (
              <>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>Steps</h3>
                <ol style={{ paddingLeft: "1.25rem", marginBottom: "1rem" }}>
                  {(viewSlot.recipe.instructions as any[]).map((step: any, i: number) => (
                    <li key={i} style={{ fontSize: "0.875rem", color: "var(--food-text)", lineHeight: 1.6, marginBottom: "0.375rem" }}>
                      {step.text}
                      {step.duration && <span style={{ color: "var(--food-text-secondary)", marginLeft: "0.375rem" }}>({step.duration} min)</span>}
                    </li>
                  ))}
                </ol>
              </>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="food-btn food-btn-primary" onClick={handleSaveIngredients}>Save Changes</button>
              <Link href={`/food/cook/${viewSlot.recipe.slug}`} className="food-btn food-btn-mint" style={{ textDecoration: "none" }}>🍳 Cook Mode</Link>
              <Link href={`/food/recipes/${viewSlot.recipe.slug}`} className="food-btn food-btn-secondary" style={{ textDecoration: "none" }}>Full Recipe</Link>
            </div>
          </div>
        </div>
      )}

      {/* ===== GROCERY PREVIEW MODAL (pantry cross-check) ===== */}
      {showGroceryPreview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }} onClick={(e) => { if (e.target === e.currentTarget) { setShowGroceryPreview(false); setGroceryGenerated(false); } }}>
          <div className="food-card" style={{ maxWidth: 550, width: "100%", padding: "1.5rem", maxHeight: "85vh", overflow: "auto" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "0.25rem" }}>
              🛒 Shopping List Preview
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)", marginBottom: "1rem" }}>
              {groceryPreview.filter((g) => !g.inPantry).length} items to buy — {groceryPreview.filter((g) => g.inPantry).length} already in pantry
            </p>

            {/* Items to buy */}
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--food-pink)", marginBottom: "0.5rem" }}>Need to Buy</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "1.25rem" }}>
              {groceryPreview.filter((g) => !g.inPantry).map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", borderBottom: "1px solid rgba(244,114,182,0.08)", fontSize: "0.875rem" }}>
                  <span style={{ color: "var(--food-text)", fontWeight: 500 }}>{item.name}</span>
                  <span style={{ color: "var(--food-text-secondary)" }}>{item.quantity} {item.unit}</span>
                </div>
              ))}
              {groceryPreview.filter((g) => !g.inPantry).length === 0 && (
                <p style={{ color: "var(--food-mint)", fontWeight: 500, textAlign: "center", padding: "0.5rem" }}>You have everything! 🎉</p>
              )}
            </div>

            {/* Already in pantry */}
            {groceryPreview.filter((g) => g.inPantry).length > 0 && (
              <>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--food-mint)", marginBottom: "0.5rem" }}>✓ Already in Pantry</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "1.25rem" }}>
                  {groceryPreview.filter((g) => g.inPantry).map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.375rem 0", borderBottom: "1px solid rgba(110,231,183,0.08)", fontSize: "0.875rem" }}>
                      <span style={{ color: "var(--food-text-secondary)", textDecoration: "line-through" }}>{item.name}</span>
                      <span style={{ color: "var(--food-text-secondary)" }}>{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Actions */}
            {groceryGenerated ? (
              <div style={{ textAlign: "center" }}>
                <p style={{ color: "var(--food-mint)", fontWeight: 600, marginBottom: "0.75rem" }}>✓ Shopping list created!</p>
                <Link href="/food/groceries" className="food-btn food-btn-primary" style={{ textDecoration: "none" }}>View Shopping List</Link>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="food-btn food-btn-primary" onClick={handleConfirmGroceryList} disabled={generatingGroceries} style={{ flex: 1 }}>
                  {generatingGroceries ? "Creating..." : "Create Shopping List"}
                </button>
                <button className="food-btn food-btn-secondary" onClick={() => setShowGroceryPreview(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
