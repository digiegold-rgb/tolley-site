"use client";

import { useState } from "react";
import { FoodPantryItem } from "./food-pantry-item";

interface PantryItem {
  id: string;
  name: string;
  location: string;
  quantity: number;
  unit?: string;
  expiresAt?: string;
  status: string;
  category?: string;
}

interface FoodPantryGridProps {
  items: PantryItem[];
  onUpdateStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}

const LOCATIONS = [
  { key: "fridge", label: "Fridge", emoji: "🧊" },
  { key: "pantry", label: "Pantry", emoji: "🗄️" },
  { key: "freezer", label: "Freezer", emoji: "❄️" },
  { key: "spice-rack", label: "Spice Rack", emoji: "🧂" },
];

export function FoodPantryGrid({ items, onUpdateStatus, onDelete }: FoodPantryGridProps) {
  const [activeTab, setActiveTab] = useState("fridge");

  const filteredItems = items.filter(
    (item) => item.location.toLowerCase().replace(/\s+/g, "-") === activeTab
  );

  return (
    <div className="food-enter">
      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--food-border)" }}>
        {LOCATIONS.map((loc) => {
          const count = items.filter(
            (i) => i.location.toLowerCase().replace(/\s+/g, "-") === loc.key
          ).length;
          return (
            <button
              key={loc.key}
              className={`food-tab${activeTab === loc.key ? " active" : ""}`}
              onClick={() => setActiveTab(loc.key)}
            >
              {loc.emoji} {loc.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--food-text-secondary)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
            {LOCATIONS.find((l) => l.key === activeTab)?.emoji || "📦"}
          </div>
          <p>Nothing here yet!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
          {filteredItems.map((item) => (
            <FoodPantryItem
              key={item.id}
              item={item}
              onUpdateStatus={(status) => onUpdateStatus(item.id, status)}
              onDelete={() => onDelete(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
