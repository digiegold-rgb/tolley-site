"use client";

import { useState, useEffect, useCallback } from "react";

interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  category?: string;
  aisle?: string;
  estimatedPrice?: number;
  isChecked: boolean;
  addedBy: string;
}

interface GroceryList {
  id: string;
  store?: string;
  status: string;
  estimatedTotal?: number;
  actualTotal?: number;
  items: GroceryItem[];
  createdAt: string;
}

const CATEGORIES = ["produce", "dairy", "meat", "pantry", "frozen", "bakery", "beverages", "snacks", "household", "other"];

export default function GroceriesPage() {
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [activeList, setActiveList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch("/api/food/groceries");
      if (res.ok) {
        const data = await res.json();
        const allLists: GroceryList[] = data.lists || [];
        setLists(allLists);
        if (allLists.length > 0) {
          const active = allLists.find((l) => l.status === "shopping") || allLists.find((l) => l.status === "active") || allLists[0];
          // Fetch full list detail with items
          try {
            const detailRes = await fetch(`/api/food/groceries/${active.id}`);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              setActiveList(detailData.list || detailData);
            } else {
              setActiveList(active);
            }
          } catch {
            setActiveList(active);
          }
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const handleToggleItem = async (itemId: string, checked: boolean) => {
    if (!activeList) return;
    // Optimistic update
    setActiveList((prev) =>
      prev
        ? { ...prev, items: prev.items.map((item) => item.id === itemId ? { ...item, isChecked: checked } : item) }
        : null
    );
    try {
      await fetch(`/api/food/groceries/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isChecked: checked }),
      });
    } catch {
      fetchLists();
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!activeList) return;
    setActiveList((prev) =>
      prev ? { ...prev, items: prev.items.filter((item) => item.id !== itemId) } : null
    );
    try {
      await fetch(`/api/food/groceries/items/${itemId}`, { method: "DELETE" });
    } catch {
      fetchLists();
    }
  };

  const handleAddItem = async () => {
    if (!activeList || !newItem.trim()) return;
    setAddingItem(true);
    try {
      const res = await fetch(`/api/food/groceries/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: activeList.id, name: newItem.trim() }),
      });
      if (res.ok) {
        setNewItem("");
        fetchLists();
      }
    } catch {
      // silent
    } finally {
      setAddingItem(false);
    }
  };

  const handleStartShopping = async () => {
    if (!activeList) return;
    try {
      await fetch(`/api/food/groceries/${activeList.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "shopping" }),
      });
      fetchLists();
    } catch {
      // silent
    }
  };

  const handleMarkComplete = async () => {
    if (!activeList) return;
    try {
      await fetch(`/api/food/groceries/${activeList.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      fetchLists();
    } catch {
      // silent
    }
  };

  // Group items by category/aisle
  const groupItems = (items: GroceryItem[]) => {
    const groups: Record<string, GroceryItem[]> = {};
    items.forEach((item) => {
      const key = item.aisle || item.category || "Other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  };

  if (loading) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", animation: "food-sparkle 1.5s ease-in-out infinite" }}>🛒</div>
        <p style={{ color: "var(--food-text-secondary)", marginTop: "1rem" }}>Loading groceries...</p>
      </div>
    );
  }

  if (!activeList) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <h1
          className="food-enter"
          style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "1.5rem" }}
        >
          Groceries
        </h1>
        <div
          className="food-card food-enter"
          style={{ textAlign: "center", padding: "4rem 2rem", "--enter-delay": "0.1s" } as React.CSSProperties}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🛒</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>
            No grocery lists yet
          </h2>
          <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem" }}>
            Create a meal plan first, then generate a grocery list automatically!
          </p>
          <a href="/food/plan" className="food-btn food-btn-primary">
            Go to Meal Plan
          </a>
        </div>
      </div>
    );
  }

  const checkedCount = activeList.items.filter((i) => i.isChecked).length;
  const totalCount = activeList.items.length;
  const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const allChecked = totalCount > 0 && checkedCount === totalCount;
  const groupedItems = groupItems(activeList.items.filter((i) => !i.isChecked));
  const checkedItems = activeList.items.filter((i) => i.isChecked);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div
        className="food-enter"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--food-text)" }}>
          Groceries
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {activeList.status === "active" && (
            <button className="food-btn food-btn-primary" onClick={handleStartShopping}>
              Start Shopping
            </button>
          )}
          {activeList.status === "shopping" && allChecked && (
            <button className="food-btn food-btn-mint" onClick={handleMarkComplete}>
              Mark Complete
            </button>
          )}
        </div>
      </div>

      {/* List selector if multiple */}
      {lists.length > 1 && (
        <div
          className="food-enter"
          style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", overflowX: "auto", "--enter-delay": "0.05s" } as React.CSSProperties}
        >
          {lists.map((list) => (
            <button
              key={list.id}
              className={`food-tab ${list.id === activeList.id ? "active" : ""}`}
              onClick={async () => {
                try {
                  const detailRes = await fetch(`/api/food/groceries/${list.id}`);
                  if (detailRes.ok) {
                    const detailData = await detailRes.json();
                    setActiveList(detailData.list || detailData);
                  } else {
                    setActiveList(list);
                  }
                } catch {
                  setActiveList(list);
                }
              }}
            >
              {list.store || (list.createdAt ? new Date(list.createdAt).toLocaleDateString() : "List")}
              <span className="food-tag food-tag-lavender" style={{ marginLeft: "0.375rem" }}>
                {list.items.length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div
        className="food-card food-enter"
        style={{ padding: "1rem 1.25rem", marginBottom: "1rem", "--enter-delay": "0.1s" } as React.CSSProperties}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--food-text)" }}>
            {checkedCount} of {totalCount} items
          </span>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--food-pink)" }}>
            {progress}%
          </span>
        </div>
        <div style={{ height: "8px", borderRadius: "4px", background: "var(--food-border)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              borderRadius: "4px",
              background: allChecked
                ? "linear-gradient(135deg, var(--food-mint), #34d399)"
                : "linear-gradient(135deg, var(--food-pink), var(--food-lavender))",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Add item */}
      <div
        className="food-enter"
        style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", "--enter-delay": "0.15s" } as React.CSSProperties}
      >
        <input
          className="food-input"
          placeholder="Add an item..."
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
          style={{ flex: 1 }}
        />
        <button
          className="food-btn food-btn-primary"
          onClick={handleAddItem}
          disabled={!newItem.trim() || addingItem}
          style={{ opacity: !newItem.trim() || addingItem ? 0.6 : 1, padding: "0.625rem 1rem" }}
        >
          +
        </button>
      </div>

      {/* Unchecked items by group */}
      {Object.keys(groupedItems).length > 0 && (
        <div
          className="food-card food-enter"
          style={{ padding: "1.25rem", marginBottom: "1rem", "--enter-delay": "0.2s" } as React.CSSProperties}
        >
          {Object.entries(groupedItems).map(([group, items]) => (
            <div key={group} className="food-aisle-group">
              <div className="food-aisle-header">{group}</div>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.5rem 0",
                    borderBottom: "1px solid rgba(244, 114, 182, 0.08)",
                  }}
                >
                  <input
                    type="checkbox"
                    className="food-check"
                    checked={item.isChecked}
                    onChange={(e) => handleToggleItem(item.id, e.target.checked)}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500, color: "var(--food-text)", fontSize: "0.9375rem" }}>
                      {item.name}
                    </span>
                    {(item.quantity > 1 || item.unit) && (
                      <span style={{ color: "var(--food-text-secondary)", fontSize: "0.8125rem", marginLeft: "0.375rem" }}>
                        {item.quantity > 1 ? item.quantity : ""} {item.unit || ""}
                      </span>
                    )}
                  </div>
                  {item.estimatedPrice && (
                    <span style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)" }}>
                      ${item.estimatedPrice.toFixed(2)}
                    </span>
                  )}
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    style={{ background: "none", border: "none", color: "var(--food-text-secondary)", cursor: "pointer", fontSize: "1rem", padding: "0.125rem 0.25rem" }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Checked items (collapsed) */}
      {checkedItems.length > 0 && (
        <div
          className="food-card food-enter"
          style={{ padding: "1.25rem", opacity: 0.7, "--enter-delay": "0.25s" } as React.CSSProperties}
        >
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--food-text-secondary)", marginBottom: "0.75rem" }}>
            Checked ({checkedItems.length})
          </h3>
          {checkedItems.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.375rem 0",
              }}
            >
              <input
                type="checkbox"
                className="food-check"
                checked={true}
                onChange={() => handleToggleItem(item.id, false)}
              />
              <span style={{ textDecoration: "line-through", color: "var(--food-text-secondary)", fontSize: "0.9375rem" }}>
                {item.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty list */}
      {totalCount === 0 && (
        <div
          className="food-card food-enter"
          style={{ textAlign: "center", padding: "3rem 2rem", "--enter-delay": "0.15s" } as React.CSSProperties}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🛒</div>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>
            This list is empty
          </h3>
          <p style={{ color: "var(--food-text-secondary)", fontSize: "0.875rem" }}>
            Add items manually or generate from your meal plan!
          </p>
        </div>
      )}
    </div>
  );
}
