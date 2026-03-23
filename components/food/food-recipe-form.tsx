"use client";

import { useState } from "react";

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
  notes: string;
}

interface Instruction {
  text: string;
  duration: string;
}

interface FoodRecipeFormProps {
  recipe?: any;
  onSubmit: (data: any) => void;
  isGenerating?: boolean;
}

const CUISINE_OPTIONS = [
  "", "American", "Mexican", "Italian", "Chinese", "Japanese", "Korean",
  "Indian", "Thai", "Mediterranean", "French", "Greek", "Southern", "Other",
];

const MEAL_TYPE_OPTIONS = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Side"];

export function FoodRecipeForm({ recipe, onSubmit, isGenerating }: FoodRecipeFormProps) {
  const [title, setTitle] = useState(recipe?.title || "");
  const [description, setDescription] = useState(recipe?.description || "");
  const [cuisine, setCuisine] = useState(recipe?.cuisine || "");
  const [mealTypes, setMealTypes] = useState<string[]>(recipe?.mealType || []);
  const [prepTime, setPrepTime] = useState(recipe?.prepTime?.toString() || "");
  const [cookTime, setCookTime] = useState(recipe?.cookTime?.toString() || "");
  const [servings, setServings] = useState(recipe?.servings?.toString() || "");
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    recipe?.ingredients?.map((i: any) => ({
      name: i.name || "",
      quantity: i.quantity?.toString() || "",
      unit: i.unit || "",
      notes: i.notes || "",
    })) || [{ name: "", quantity: "", unit: "", notes: "" }]
  );
  const [instructions, setInstructions] = useState<Instruction[]>(
    recipe?.instructions?.map((s: any) => ({
      text: typeof s === "string" ? s : s.text || "",
      duration: typeof s === "string" ? "" : s.duration?.toString() || "",
    })) || [{ text: "", duration: "" }]
  );
  const [tags, setTags] = useState(recipe?.tags?.join(", ") || "");
  const [imageUrl, setImageUrl] = useState(recipe?.imageUrl || "");

  const toggleMealType = (type: string) => {
    setMealTypes((prev) =>
      prev.includes(type) ? prev.filter((t: string) => t !== type) : [...prev, type]
    );
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)));
  };

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { name: "", quantity: "", unit: "", notes: "" }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const updateInstruction = (index: number, field: keyof Instruction, value: string) => {
    setInstructions((prev) => prev.map((step, i) => (i === index ? { ...step, [field]: value } : step)));
  };

  const addInstruction = () => {
    setInstructions((prev) => [...prev, { text: "", duration: "" }]);
  };

  const removeInstruction = (index: number) => {
    setInstructions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      cuisine: cuisine || undefined,
      mealType: mealTypes,
      prepTime: prepTime ? parseInt(prepTime) : undefined,
      cookTime: cookTime ? parseInt(cookTime) : undefined,
      servings: servings ? parseInt(servings) : undefined,
      ingredients: ingredients.filter((i) => i.name.trim()),
      instructions: instructions.filter((s) => s.text.trim()),
      tags: tags.split(",").map((t: string) => t.trim()).filter(Boolean),
      imageUrl: imageUrl || undefined,
    });
  };

  const fieldStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { display: "block", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.375rem", fontSize: "0.875rem" };
  const groupStyle: React.CSSProperties = { marginBottom: "1.25rem" };

  return (
    <form onSubmit={handleSubmit} className="food-enter" style={{ maxWidth: "700px", margin: "0 auto" }}>
      {/* Title */}
      <div style={groupStyle}>
        <label style={labelStyle}>Recipe Title *</label>
        <input
          className="food-input"
          style={fieldStyle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What are we making?"
          required
        />
      </div>

      {/* Description */}
      <div style={groupStyle}>
        <label style={labelStyle}>Description</label>
        <textarea
          className="food-input"
          style={{ ...fieldStyle, resize: "vertical" }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the dish..."
          rows={3}
        />
      </div>

      {/* Cuisine + Times Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.75rem", ...groupStyle }}>
        <div>
          <label style={labelStyle}>Cuisine</label>
          <select
            className="food-input"
            style={fieldStyle}
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
          >
            {CUISINE_OPTIONS.map((c) => (
              <option key={c} value={c}>{c || "Select..."}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Prep (min)</label>
          <input className="food-input" style={fieldStyle} type="number" min="0" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Cook (min)</label>
          <input className="food-input" style={fieldStyle} type="number" min="0" value={cookTime} onChange={(e) => setCookTime(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Servings</label>
          <input className="food-input" style={fieldStyle} type="number" min="1" value={servings} onChange={(e) => setServings(e.target.value)} />
        </div>
      </div>

      {/* Meal Types */}
      <div style={groupStyle}>
        <label style={labelStyle}>Meal Type</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {MEAL_TYPE_OPTIONS.map((type) => (
            <label key={type} style={{ display: "flex", alignItems: "center", gap: "0.375rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                className="food-check"
                checked={mealTypes.includes(type)}
                onChange={() => toggleMealType(type)}
              />
              <span style={{ fontSize: "0.875rem", color: "var(--food-text)" }}>{type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Ingredients */}
      <div style={groupStyle}>
        <label style={labelStyle}>Ingredients</label>
        {ingredients.map((ing, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 2fr auto", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <input className="food-input" placeholder="Name" value={ing.name} onChange={(e) => updateIngredient(i, "name", e.target.value)} />
            <input className="food-input" placeholder="Qty" value={ing.quantity} onChange={(e) => updateIngredient(i, "quantity", e.target.value)} />
            <input className="food-input" placeholder="Unit" value={ing.unit} onChange={(e) => updateIngredient(i, "unit", e.target.value)} />
            <input className="food-input" placeholder="Notes" value={ing.notes} onChange={(e) => updateIngredient(i, "notes", e.target.value)} />
            <button type="button" className="food-btn food-btn-secondary" onClick={() => removeIngredient(i)} style={{ padding: "0.375rem 0.625rem" }}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="food-btn food-btn-secondary" onClick={addIngredient}>
          + Add Ingredient
        </button>
      </div>

      {/* Instructions */}
      <div style={groupStyle}>
        <label style={labelStyle}>Instructions</label>
        {instructions.map((step, i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "flex-start" }}>
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
                fontSize: "0.8125rem",
                flexShrink: 0,
                marginTop: "0.375rem",
              }}
            >
              {i + 1}
            </div>
            <textarea
              className="food-input"
              style={{ flex: 1, resize: "vertical" }}
              placeholder="Describe this step..."
              value={step.text}
              onChange={(e) => updateInstruction(i, "text", e.target.value)}
              rows={2}
            />
            <input
              className="food-input"
              style={{ width: "5rem" }}
              placeholder="Min"
              type="number"
              min="0"
              value={step.duration}
              onChange={(e) => updateInstruction(i, "duration", e.target.value)}
            />
            <button type="button" className="food-btn food-btn-secondary" onClick={() => removeInstruction(i)} style={{ padding: "0.375rem 0.625rem" }}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="food-btn food-btn-secondary" onClick={addInstruction}>
          + Add Step
        </button>
      </div>

      {/* Tags */}
      <div style={groupStyle}>
        <label style={labelStyle}>Tags (comma separated)</label>
        <input
          className="food-input"
          style={fieldStyle}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="quick, healthy, kid-friendly..."
        />
      </div>

      {/* Image URL */}
      <div style={groupStyle}>
        <label style={labelStyle}>Image URL</label>
        <input
          className="food-input"
          style={fieldStyle}
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.5rem" }}>
        <button type="submit" className="food-btn food-btn-primary food-glow">
          {recipe ? "Update Recipe" : "Save Recipe"} 💾
        </button>
        <button
          type="button"
          className="food-btn food-btn-mint"
          disabled={isGenerating}
          onClick={() => onSubmit({ __action: "generate", title, description, cuisine })}
          style={{ opacity: isGenerating ? 0.6 : 1 }}
        >
          {isGenerating ? "Generating..." : "✨ Generate with AI"}
        </button>
      </div>
    </form>
  );
}
