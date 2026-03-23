"use client";

interface PantryItemData {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  expiresAt?: string;
  status: string;
  category?: string;
}

interface FoodPantryItemProps {
  item: PantryItemData;
  onUpdateStatus: (status: string) => void;
  onDelete: () => void;
}

function getExpiryInfo(expiresAt?: string): { label: string; className: string } | null {
  if (!expiresAt) return null;
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `Expired ${Math.abs(diffDays)}d ago`, className: "food-expiry-urgent" };
  if (diffDays <= 3) return { label: `${diffDays}d left`, className: "food-expiry-urgent" };
  if (diffDays <= 7) return { label: `${diffDays}d left`, className: "food-expiry-soon" };
  return { label: `${diffDays}d left`, className: "food-expiry-ok" };
}

const STATUS_TAGS: Record<string, string> = {
  full: "food-tag-mint",
  low: "food-tag-peach",
  out: "food-tag-pink",
  good: "food-tag-mint",
};

export function FoodPantryItem({ item, onUpdateStatus, onDelete }: FoodPantryItemProps) {
  const expiry = getExpiryInfo(item.expiresAt);
  const tagClass = STATUS_TAGS[item.status] || "food-tag-lavender";

  return (
    <div className="food-card" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <h4 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--food-text)", margin: 0 }}>
          {item.name}
        </h4>
        {item.category && (
          <span className="food-tag food-tag-lavender">{item.category}</span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.8125rem" }}>
        <span style={{ color: "var(--food-text-secondary)" }}>
          {item.quantity}{item.unit ? ` ${item.unit}` : ""}
        </span>
        <span className={`food-tag ${tagClass}`}>{item.status}</span>
      </div>

      {expiry && (
        <div className={expiry.className} style={{ fontSize: "0.8125rem" }}>
          ⏰ {expiry.label}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.25rem" }}>
        <button
          className="food-btn food-btn-secondary"
          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
          onClick={() => onUpdateStatus("low")}
        >
          Mark Low
        </button>
        <button
          className="food-btn food-btn-secondary"
          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
          onClick={() => onUpdateStatus("out")}
        >
          Mark Out
        </button>
        <button
          className="food-btn food-btn-secondary"
          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "#ef4444" }}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
