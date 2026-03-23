"use client";

import { FoodGroceryItem } from "./food-grocery-item";

interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  category?: string;
  aisle?: string;
  estimatedPrice?: number;
  isChecked: boolean;
}

interface FoodGroceryListProps {
  items: GroceryItem[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

export function FoodGroceryList({ items, onToggle, onRemove }: FoodGroceryListProps) {
  const checkedCount = items.filter((i) => i.isChecked).length;
  const progress = items.length > 0 ? (checkedCount / items.length) * 100 : 0;

  // Group by aisle, putting unchecked first within each group
  const grouped = items.reduce<Record<string, GroceryItem[]>>((acc, item) => {
    const aisle = item.aisle || "Other";
    if (!acc[aisle]) acc[aisle] = [];
    acc[aisle].push(item);
    return acc;
  }, {});

  // Sort items within each aisle: unchecked first, then checked
  for (const aisle of Object.keys(grouped)) {
    grouped[aisle].sort((a, b) => Number(a.isChecked) - Number(b.isChecked));
  }

  const aisles = Object.keys(grouped).sort();
  const estimatedTotal = items.reduce((sum, i) => sum + (i.estimatedPrice || 0) * i.quantity, 0);

  return (
    <div className="food-enter">
      {/* Progress */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.875rem" }}>
          <span style={{ color: "var(--food-text)" }}>
            {checkedCount}/{items.length} items checked
          </span>
          {estimatedTotal > 0 && (
            <span style={{ color: "var(--food-lavender)", fontWeight: 500 }}>
              Est. ${estimatedTotal.toFixed(2)}
            </span>
          )}
        </div>
        <div
          style={{
            height: "8px",
            borderRadius: "4px",
            background: "var(--food-border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(135deg, var(--food-pink), var(--food-lavender))",
              borderRadius: "4px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Aisle Groups */}
      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--food-text-secondary)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🛒</div>
          <p>Your grocery list is empty!</p>
        </div>
      ) : (
        aisles.map((aisle) => (
          <div key={aisle} className="food-aisle-group">
            <div className="food-aisle-header">
              {aisle}
            </div>
            {grouped[aisle].map((item) => (
              <FoodGroceryItem
                key={item.id}
                item={item}
                onToggle={() => onToggle(item.id)}
                onRemove={() => onRemove(item.id)}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
