"use client";

interface GroceryItemData {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  estimatedPrice?: number;
  isChecked: boolean;
}

interface FoodGroceryItemProps {
  item: GroceryItemData;
  onToggle: () => void;
  onRemove: () => void;
}

export function FoodGroceryItem({ item, onToggle, onRemove }: FoodGroceryItemProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.5rem 0",
        opacity: item.isChecked ? 0.5 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <input
        type="checkbox"
        className="food-check"
        checked={item.isChecked}
        onChange={onToggle}
      />
      <span
        style={{
          flex: 1,
          color: "var(--food-text)",
          textDecoration: item.isChecked ? "line-through" : "none",
          fontSize: "0.9375rem",
        }}
      >
        {item.name}
      </span>
      <span style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)", whiteSpace: "nowrap" }}>
        {item.quantity}{item.unit ? ` ${item.unit}` : ""}
      </span>
      {item.estimatedPrice !== undefined && (
        <span style={{ fontSize: "0.8125rem", color: "var(--food-lavender)", fontWeight: 500, whiteSpace: "nowrap" }}>
          ${item.estimatedPrice.toFixed(2)}
        </span>
      )}
      <button
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          color: "var(--food-text-secondary)",
          cursor: "pointer",
          fontSize: "1rem",
          padding: "0 0.25rem",
          lineHeight: 1,
        }}
        aria-label={`Remove ${item.name}`}
      >
        ✕
      </button>
    </div>
  );
}
