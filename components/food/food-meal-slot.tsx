"use client";

interface MealSlotData {
  id: string;
  recipe?: { title: string };
  customMeal?: string;
}

interface FoodMealSlotProps {
  slot?: MealSlotData;
  mealType: string;
  onClick: () => void;
  onClear?: () => void;
}

const MEAL_EMOJIS: Record<string, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍪",
};

export function FoodMealSlot({ slot, mealType, onClick, onClear }: FoodMealSlotProps) {
  const isFilled = slot && (slot.recipe || slot.customMeal);
  const emoji = MEAL_EMOJIS[mealType.toLowerCase()] || "🍽️";

  return (
    <div
      className={`food-slot${isFilled ? " filled" : ""}`}
      onClick={!isFilled ? onClick : undefined}
      style={{ position: "relative" }}
    >
      <div style={{ fontSize: "0.6875rem", color: "var(--food-text-secondary)", marginBottom: "0.125rem" }}>
        {emoji} {mealType}
      </div>
      {isFilled ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{ fontSize: "0.8125rem", color: "var(--food-text)", fontWeight: 500, cursor: "pointer" }}
            onClick={onClick}
          >
            {slot!.recipe?.title || slot!.customMeal}
          </span>
          {onClear && (
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              style={{
                background: "none",
                border: "none",
                color: "var(--food-text-secondary)",
                cursor: "pointer",
                fontSize: "0.875rem",
                padding: "0 0.25rem",
                lineHeight: 1,
              }}
              aria-label="Clear slot"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <div style={{ textAlign: "center", color: "var(--food-border)", fontSize: "1.25rem", lineHeight: 1 }}>
          +
        </div>
      )}
    </div>
  );
}
