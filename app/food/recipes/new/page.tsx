"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
  notes: string;
}

interface Instruction {
  step: number;
  text: string;
  duration: string;
}

const CUISINES = ["Italian", "Mexican", "American", "Asian", "Indian", "Mediterranean", "Japanese", "Thai", "Chinese", "French"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "dessert"];
const TAG_OPTIONS = ["kid-friendly", "quick", "comfort", "healthy", "budget", "one-pot", "meal-prep", "date-night", "holiday", "slow-cooker"];

const emptyIngredient = (): Ingredient => ({ name: "", quantity: "", unit: "", notes: "" });
const emptyInstruction = (step: number): Instruction => ({ step, text: "", duration: "" });

export default function NewRecipePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [mealType, setMealType] = useState<string[]>([]);
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("4");
  const [tags, setTags] = useState<string[]>([]);
  const [source, setSource] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([emptyIngredient()]);
  const [instructions, setInstructions] = useState<Instruction[]>([emptyInstruction(1)]);

  const toggleMealType = (mt: string) => {
    setMealType((prev) => prev.includes(mt) ? prev.filter((m) => m !== mt) : [...prev, mt]);
  };

  const toggleTag = (tag: string) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const updateIngredient = (i: number, field: keyof Ingredient, value: string) => {
    setIngredients((prev) => prev.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing));
  };

  const addIngredient = () => setIngredients((prev) => [...prev, emptyIngredient()]);

  const removeIngredient = (i: number) => {
    if (ingredients.length <= 1) return;
    setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateInstruction = (i: number, field: keyof Instruction, value: string) => {
    setInstructions((prev) => prev.map((ins, idx) => idx === i ? { ...ins, [field]: value } : ins));
  };

  const addInstruction = () => {
    setInstructions((prev) => [...prev, emptyInstruction(prev.length + 1)]);
  };

  const removeInstruction = (i: number) => {
    if (instructions.length <= 1) return;
    setInstructions((prev) => prev.filter((_, idx) => idx !== i).map((ins, idx) => ({ ...ins, step: idx + 1 })));
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError("Please enter a recipe title"); return; }
    if (ingredients.every((ing) => !ing.name.trim())) { setError("Add at least one ingredient"); return; }
    if (instructions.every((ins) => !ins.text.trim())) { setError("Add at least one instruction step"); return; }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/food/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          cuisine: cuisine || undefined,
          mealType,
          prepTime: prepTime ? parseInt(prepTime) : undefined,
          cookTime: cookTime ? parseInt(cookTime) : undefined,
          servings: parseInt(servings) || 4,
          tags,
          source: source.trim() || undefined,
          ingredients: ingredients.filter((ing) => ing.name.trim()),
          instructions: instructions.filter((ins) => ins.text.trim()).map((ins, idx) => ({
            ...ins,
            step: idx + 1,
            duration: ins.duration ? parseInt(ins.duration) : undefined,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/food/recipes/${data.slug || data.recipe?.slug}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save recipe");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateAI = async () => {
    setGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/food/recipes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuisine: cuisine || undefined,
          mealType: mealType[0] || "dinner",
          returnOnly: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
        if (data.cuisine) setCuisine(data.cuisine);
        if (data.mealType) setMealType(Array.isArray(data.mealType) ? data.mealType : [data.mealType]);
        if (data.prepTime) setPrepTime(String(data.prepTime));
        if (data.cookTime) setCookTime(String(data.cookTime));
        if (data.servings) setServings(String(data.servings));
        if (data.tags) setTags(data.tags);
        if (data.ingredients?.length) setIngredients(data.ingredients);
        if (data.instructions?.length) setInstructions(data.instructions.map((ins: Instruction, i: number) => ({ ...ins, step: i + 1, duration: ins.duration ? String(ins.duration) : "" })));
      } else {
        setError("AI generation failed, try again");
      }
    } catch {
      setError("AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div
        className="food-enter"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--food-text)" }}>
          New Recipe
        </h1>
        <button
          className="food-btn food-btn-primary food-glow"
          onClick={handleGenerateAI}
          disabled={generating}
          style={{ opacity: generating ? 0.7 : 1 }}
        >
          {generating ? "Generating..." : "Generate with AI"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "#dc2626",
            fontSize: "0.875rem",
            marginBottom: "1.5rem",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Basic info */}
        <div className="food-card food-enter" style={{ padding: "1.25rem", "--enter-delay": "0.1s" } as React.CSSProperties}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            Basic Info
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <input
              className="food-input"
              placeholder="Recipe title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", fontSize: "1.125rem", fontWeight: 500 }}
            />
            <textarea
              className="food-input"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              style={{ width: "100%", resize: "vertical" }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <select
                className="food-input"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
              >
                <option value="">Select Cuisine</option>
                {CUISINES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                className="food-input"
                placeholder="Source (URL, book, family)"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </div>

            {/* Meal type toggles */}
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.375rem" }}>
                Meal Type
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {MEAL_TYPES.map((mt) => (
                  <button
                    key={mt}
                    type="button"
                    className={`food-tag ${mealType.includes(mt) ? "food-tag-pink" : ""}`}
                    onClick={() => toggleMealType(mt)}
                    style={{
                      cursor: "pointer",
                      border: "1px solid var(--food-border)",
                      background: mealType.includes(mt) ? "rgba(244, 114, 182, 0.15)" : "white",
                      padding: "0.35rem 0.75rem",
                    }}
                  >
                    {mt.charAt(0).toUpperCase() + mt.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.25rem" }}>
                  Prep Time (min)
                </label>
                <input
                  className="food-input"
                  type="number"
                  placeholder="15"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.25rem" }}>
                  Cook Time (min)
                </label>
                <input
                  className="food-input"
                  type="number"
                  placeholder="30"
                  value={cookTime}
                  onChange={(e) => setCookTime(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.25rem" }}>
                  Servings
                </label>
                <input
                  className="food-input"
                  type="number"
                  placeholder="4"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.375rem" }}>
                Tags
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {TAG_OPTIONS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`food-tag ${tags.includes(tag) ? "food-tag-mint" : ""}`}
                    onClick={() => toggleTag(tag)}
                    style={{
                      cursor: "pointer",
                      border: "1px solid var(--food-border)",
                      background: tags.includes(tag) ? "rgba(110, 231, 183, 0.15)" : "white",
                      padding: "0.35rem 0.75rem",
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div className="food-card food-enter" style={{ padding: "1.25rem", "--enter-delay": "0.15s" } as React.CSSProperties}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            Ingredients
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {ingredients.map((ing, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 80px 1fr auto auto", gap: "0.5rem", alignItems: "center" }}>
                <input
                  className="food-input"
                  placeholder="Qty"
                  value={ing.quantity}
                  onChange={(e) => updateIngredient(i, "quantity", e.target.value)}
                  style={{ fontSize: "0.875rem", padding: "0.5rem" }}
                />
                <input
                  className="food-input"
                  placeholder="Unit"
                  value={ing.unit}
                  onChange={(e) => updateIngredient(i, "unit", e.target.value)}
                  style={{ fontSize: "0.875rem", padding: "0.5rem" }}
                />
                <input
                  className="food-input"
                  placeholder="Ingredient name"
                  value={ing.name}
                  onChange={(e) => updateIngredient(i, "name", e.target.value)}
                  style={{ fontSize: "0.875rem", padding: "0.5rem" }}
                />
                <input
                  className="food-input"
                  placeholder="Notes"
                  value={ing.notes}
                  onChange={(e) => updateIngredient(i, "notes", e.target.value)}
                  style={{ fontSize: "0.875rem", padding: "0.5rem", width: "120px" }}
                />
                <button
                  type="button"
                  onClick={() => removeIngredient(i)}
                  style={{
                    background: "none",
                    border: "none",
                    color: ingredients.length <= 1 ? "var(--food-border)" : "#ef4444",
                    cursor: ingredients.length <= 1 ? "default" : "pointer",
                    fontSize: "1.125rem",
                    padding: "0.25rem",
                  }}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="food-btn food-btn-secondary"
            onClick={addIngredient}
            style={{ marginTop: "0.75rem", fontSize: "0.8125rem" }}
          >
            + Add Ingredient
          </button>
        </div>

        {/* Instructions */}
        <div className="food-card food-enter" style={{ padding: "1.25rem", "--enter-delay": "0.2s" } as React.CSSProperties}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            Instructions
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {instructions.map((ins, i) => (
              <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
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
                    marginTop: "0.25rem",
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <textarea
                    className="food-input"
                    placeholder={`Step ${i + 1}...`}
                    value={ins.text}
                    onChange={(e) => updateInstruction(i, "text", e.target.value)}
                    rows={2}
                    style={{ width: "100%", resize: "vertical", fontSize: "0.875rem" }}
                  />
                  <input
                    className="food-input"
                    type="number"
                    placeholder="Duration (min, optional)"
                    value={ins.duration}
                    onChange={(e) => updateInstruction(i, "duration", e.target.value)}
                    style={{ width: "150px", fontSize: "0.8125rem", padding: "0.375rem 0.625rem" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeInstruction(i)}
                  style={{
                    background: "none",
                    border: "none",
                    color: instructions.length <= 1 ? "var(--food-border)" : "#ef4444",
                    cursor: instructions.length <= 1 ? "default" : "pointer",
                    fontSize: "1.125rem",
                    padding: "0.25rem",
                    marginTop: "0.25rem",
                  }}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="food-btn food-btn-secondary"
            onClick={addInstruction}
            style={{ marginTop: "0.75rem", fontSize: "0.8125rem" }}
          >
            + Add Step
          </button>
        </div>

        {/* Submit */}
        <div
          className="food-enter"
          style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", "--enter-delay": "0.25s" } as React.CSSProperties}
        >
          <button
            className="food-btn food-btn-secondary"
            onClick={() => router.push("/food/recipes")}
          >
            Cancel
          </button>
          <button
            className="food-btn food-btn-primary food-glow"
            onClick={handleSubmit}
            disabled={saving}
            style={{ opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Saving..." : "Save Recipe"}
          </button>
        </div>
      </div>
    </div>
  );
}
