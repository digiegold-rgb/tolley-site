"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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

export default function GroceriesPage() {
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [activeList, setActiveList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);

  const loadActiveDetail = async (listId: string, fallback: GroceryList) => {
    try {
      const res = await fetch(`/api/food/groceries/${listId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveList(data.list || data);
        return;
      }
    } catch {
      // fall through
    }
    setActiveList(fallback);
  };

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch("/api/food/groceries");
      if (res.ok) {
        const data = await res.json();
        const allLists: GroceryList[] = data.lists || [];
        setLists(allLists);
        if (allLists.length > 0) {
          const active =
            allLists.find((l) => l.status === "shopping") ||
            allLists.find((l) => l.status === "active") ||
            allLists[0];
          await loadActiveDetail(active.id, active);
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
    setActiveList((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((item) =>
              item.id === itemId ? { ...item, isChecked: checked } : item,
            ),
          }
        : null,
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
      prev
        ? { ...prev, items: prev.items.filter((item) => item.id !== itemId) }
        : null,
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
        setShowAddInput(false);
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
      <div
        style={{
          background: "var(--food-bg-warm)",
          minHeight: "100vh",
          textAlign: "center",
          padding: "64px 16px",
        }}
      >
        <div
          style={{
            fontSize: 36,
            animation: "food-sparkle 1.5s ease-in-out infinite",
          }}
        >
          🛒
        </div>
        <p
          style={{
            color: "var(--food-text-secondary)",
            marginTop: 12,
            fontSize: 13,
            fontFamily: "var(--font-sora), sans-serif",
          }}
        >
          Loading groceries…
        </p>
      </div>
    );
  }

  if (!activeList) {
    return (
      <div style={{ background: "var(--food-bg-warm)", minHeight: "100vh" }}>
        <h1
          style={{
            fontFamily: "var(--font-fredoka), system-ui, sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--food-text)",
            margin: 0,
            padding: "20px 16px 12px",
          }}
        >
          Groceries
        </h1>
        <div
          className="text-center"
          style={{
            margin: "0 16px",
            padding: "40px 20px",
            background: "white",
            border: "1px solid var(--food-border)",
            borderRadius: 18,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
          <h2
            style={{
              fontFamily: "var(--font-fredoka), system-ui, sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: "var(--food-text)",
              marginBottom: 6,
            }}
          >
            No grocery lists yet
          </h2>
          <p
            style={{
              color: "var(--food-text-secondary)",
              marginBottom: 16,
              fontSize: 13,
              fontFamily: "var(--font-sora), sans-serif",
            }}
          >
            Create a meal plan first, then generate a grocery list automatically.
          </p>
          <Link href="/food/plan" className="food-btn food-btn-primary">
            Go to Meal Plan
          </Link>
        </div>
      </div>
    );
  }

  const checkedCount = activeList.items.filter((i) => i.isChecked).length;
  const totalCount = activeList.items.length;
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;
  const allChecked = totalCount > 0 && checkedCount === totalCount;
  const groupedItems = groupItems(activeList.items.filter((i) => !i.isChecked));
  const checkedItems = activeList.items.filter((i) => i.isChecked);

  return (
    <div style={{ background: "var(--food-bg-warm)", minHeight: "100vh" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "20px 16px 12px", gap: 8 }}
      >
        <h1
          style={{
            fontFamily: "var(--font-fredoka), system-ui, sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--food-text)",
            margin: 0,
          }}
        >
          Groceries
        </h1>
        {activeList.status === "active" && totalCount > 0 && (
          <button
            type="button"
            onClick={handleStartShopping}
            className="cursor-pointer"
            style={{
              background:
                "linear-gradient(135deg, var(--food-pink), var(--food-lavender))",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "var(--font-fredoka), system-ui, sans-serif",
              padding: "7px 14px",
              borderRadius: 9999,
              border: "none",
              boxShadow: "0 4px 14px rgba(244,114,182,0.35)",
            }}
          >
            🛒 Start Shopping
          </button>
        )}
        {activeList.status === "shopping" && allChecked && (
          <button
            type="button"
            onClick={handleMarkComplete}
            className="cursor-pointer"
            style={{
              background:
                "linear-gradient(135deg, var(--food-mint), #34d399)",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "var(--font-fredoka), system-ui, sans-serif",
              padding: "7px 14px",
              borderRadius: 9999,
              border: "none",
              boxShadow: "0 4px 14px rgba(110,231,183,0.4)",
            }}
          >
            ✓ Mark Complete
          </button>
        )}
      </div>

      {/* List selector if multiple */}
      {lists.length > 1 && (
        <div
          className="flex"
          style={{
            gap: 6,
            padding: "0 16px 12px",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {lists.map((list) => {
            const active = list.id === activeList.id;
            return (
              <button
                key={list.id}
                type="button"
                onClick={() => loadActiveDetail(list.id, list)}
                className="cursor-pointer"
                style={{
                  flexShrink: 0,
                  padding: "5px 12px",
                  borderRadius: 9999,
                  fontSize: 12,
                  fontFamily: "var(--font-sora), sans-serif",
                  fontWeight: active ? 600 : 500,
                  border: "1.5px solid",
                  borderColor: active
                    ? "var(--food-pink)"
                    : "var(--food-border)",
                  background: active ? "rgba(244,114,182,0.10)" : "white",
                  color: active ? "#be185d" : "var(--food-text-secondary)",
                  whiteSpace: "nowrap",
                }}
              >
                {list.store ||
                  (list.createdAt
                    ? new Date(list.createdAt).toLocaleDateString()
                    : "List")}
                <span style={{ marginLeft: 6, opacity: 0.7 }}>
                  ({list.items.length})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Progress bar */}
      <div style={{ padding: "0 16px 16px" }}>
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 6 }}
        >
          <span
            style={{
              fontSize: 12,
              color: "var(--food-text-secondary)",
              fontFamily: "var(--font-sora), sans-serif",
            }}
          >
            {checkedCount} of {totalCount} done
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: allChecked ? "#047857" : "var(--food-pink)",
              fontFamily: "var(--font-fredoka), system-ui, sans-serif",
            }}
          >
            {Math.round(progress)}%
          </span>
        </div>
        <div
          style={{
            height: 6,
            background: "var(--food-border)",
            borderRadius: 9999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: allChecked
                ? "linear-gradient(135deg, var(--food-mint), #34d399)"
                : "linear-gradient(135deg, var(--food-pink), var(--food-lavender))",
              borderRadius: 9999,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* Aisle groups */}
      <div className="flex flex-col" style={{ padding: "0 16px", gap: 18 }}>
        {Object.entries(groupedItems).map(([group, items]) => (
          <div key={group}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--food-lavender)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 6,
                fontFamily: "var(--font-sora), sans-serif",
              }}
            >
              {group}
            </div>
            <div className="flex flex-col" style={{ gap: 6 }}>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleToggleItem(item.id, true)}
                  className="cursor-pointer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    background: "white",
                    border: "1px solid var(--food-border)",
                    borderRadius: 12,
                    width: "100%",
                    textAlign: "left",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: "2px solid var(--food-pink)",
                      background: "transparent",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 14,
                        color: "var(--food-text)",
                        fontFamily: "var(--font-sora), sans-serif",
                      }}
                    >
                      {item.name}
                    </span>
                  </div>
                  {(item.quantity > 1 || item.unit) && (
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--food-text-secondary)",
                        fontFamily: "var(--font-sora), sans-serif",
                      }}
                    >
                      {item.quantity > 1 ? item.quantity : ""} {item.unit || ""}
                    </span>
                  )}
                  {item.estimatedPrice ? (
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--food-text-secondary)",
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                      }}
                    >
                      ${item.estimatedPrice.toFixed(2)}
                    </span>
                  ) : null}
                  <span
                    role="button"
                    aria-label={`Remove ${item.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveItem(item.id);
                    }}
                    style={{
                      color: "var(--food-text-secondary)",
                      fontSize: 18,
                      padding: "0 4px",
                      cursor: "pointer",
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add item — dashed pill */}
      <div style={{ padding: "16px 16px 8px" }}>
        {showAddInput ? (
          <div className="flex" style={{ gap: 6 }}>
            <input
              autoFocus
              placeholder="Item name…"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddItem();
                if (e.key === "Escape") {
                  setShowAddInput(false);
                  setNewItem("");
                }
              }}
              onBlur={() => {
                if (!newItem.trim() && !addingItem) setShowAddInput(false);
              }}
              style={{
                flex: 1,
                padding: "10px 14px",
                background: "white",
                border: "1px solid var(--food-pink)",
                borderRadius: 14,
                fontSize: 14,
                color: "var(--food-text)",
                fontFamily: "var(--font-sora), sans-serif",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={handleAddItem}
              disabled={!newItem.trim() || addingItem}
              className="food-btn food-btn-primary"
              style={{
                padding: "0 16px",
                opacity: !newItem.trim() || addingItem ? 0.6 : 1,
              }}
            >
              Add
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddInput(true)}
            className="cursor-pointer"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 14,
              border: "1.5px dashed var(--food-border)",
              background: "transparent",
              color: "var(--food-text-secondary)",
              fontSize: 14,
              fontFamily: "var(--font-fredoka), system-ui, sans-serif",
            }}
          >
            + Add item
          </button>
        )}
      </div>

      {/* Empty list */}
      {totalCount === 0 && (
        <div
          className="text-center"
          style={{
            margin: "8px 16px",
            padding: "40px 20px",
            background: "white",
            border: "1px solid var(--food-border)",
            borderRadius: 18,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
          <h3
            style={{
              fontFamily: "var(--font-fredoka), system-ui, sans-serif",
              fontSize: 16,
              fontWeight: 700,
              color: "var(--food-text)",
              marginBottom: 6,
            }}
          >
            This list is empty
          </h3>
          <p
            style={{
              color: "var(--food-text-secondary)",
              fontSize: 13,
              fontFamily: "var(--font-sora), sans-serif",
            }}
          >
            Add items above or generate from your meal plan.
          </p>
        </div>
      )}

      {/* Checked items (collapsed) */}
      {checkedItems.length > 0 && (
        <div style={{ padding: "16px 16px 0", opacity: 0.55 }}>
          <h3
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--food-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 8,
              fontFamily: "var(--font-sora), sans-serif",
            }}
          >
            Checked ({checkedItems.length})
          </h3>
          <div className="flex flex-col" style={{ gap: 6 }}>
            {checkedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleToggleItem(item.id, false)}
                className="cursor-pointer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  background: "white",
                  border: "1px solid var(--food-border)",
                  borderRadius: 12,
                  width: "100%",
                  textAlign: "left",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: "2px solid var(--food-pink)",
                    background: "var(--food-pink)",
                    color: "white",
                    fontSize: 14,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  ✓
                </span>
                <span
                  style={{
                    fontSize: 14,
                    color: "var(--food-text-secondary)",
                    textDecoration: "line-through",
                    fontFamily: "var(--font-sora), sans-serif",
                  }}
                >
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}
