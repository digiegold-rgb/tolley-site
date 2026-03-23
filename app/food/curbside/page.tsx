"use client";

import { useState, useEffect } from "react";

interface GroceryList {
  id: string;
  store: string;
  _count?: { items: number };
}

interface CurbsideItem {
  searchTerm: string;
  quantity?: number;
  unit?: string;
  category: string;
}

interface CurbsideResult {
  items: CurbsideItem[];
  totalItems?: number;
}

export default function CurbsidePage() {
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [selectedList, setSelectedList] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<CurbsideResult | null>(null);
  const [error, setError] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    fetch("/api/food/groceries")
      .then((r) => r.json())
      .then((data) => {
        const groceryLists = data.lists || data;
        setLists(Array.isArray(groceryLists) ? groceryLists : []);
        if (Array.isArray(groceryLists) && groceryLists.length > 0) {
          setSelectedList(groceryLists[0].id);
        }
      })
      .catch(() => setError("Couldn't load grocery lists"))
      .finally(() => setLoading(false));
  }, []);

  const generateCurbside = async () => {
    if (!selectedList) return;
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/food/curbside", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: selectedList }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Couldn't generate curbside list. Try again!");
    } finally {
      setGenerating(false);
    }
  };

  const copyItem = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      // fallback
    }
  };

  const copyAll = async () => {
    if (!result) return;
    const text = result.items.map((i) => i.searchTerm).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // fallback
    }
  };

  // Group items by category
  const groupedItems: Record<string, CurbsideItem[]> = {};
  if (result) {
    for (const item of result.items) {
      const cat = item.category || "Other";
      if (!groupedItems[cat]) groupedItems[cat] = [];
      groupedItems[cat].push(item);
    }
  }

  const categoryColors: Record<string, string> = {
    Produce: "var(--food-mint)",
    Dairy: "var(--food-lavender)",
    Meat: "var(--food-pink)",
    Bakery: "var(--food-peach)",
    Frozen: "#93c5fd",
    Pantry: "var(--food-rose-gold)",
    Beverages: "#6ee7b7",
    Snacks: "#fdba74",
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1
        className="food-enter"
        style={{ fontSize: "2rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "0.5rem" }}
      >
        Walmart Curbside Helper {"🚗"}
      </h1>
      <p
        className="food-enter"
        style={{
          color: "var(--food-text-secondary)",
          marginBottom: "2rem",
          "--enter-delay": "0.05s",
        } as React.CSSProperties}
      >
        Turn your grocery list into search-friendly terms for the Walmart app.
      </p>

      {/* List selector */}
      {!result && (
        <div
          className="food-enter"
          style={{ "--enter-delay": "0.1s" } as React.CSSProperties}
        >
          {loading ? (
            <p style={{ color: "var(--food-text-secondary)" }}>Loading grocery lists...</p>
          ) : lists.length === 0 ? (
            <div className="food-card" style={{ padding: "2rem", textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>{"🛒"}</div>
              <p style={{ color: "var(--food-text-secondary)", marginBottom: "1rem" }}>
                No grocery lists yet. Create one first!
              </p>
              <a href="/food/groceries" className="food-btn food-btn-primary">
                Go to Groceries
              </a>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.9375rem",
                    fontWeight: 500,
                    color: "var(--food-text)",
                    marginBottom: "0.5rem",
                  }}
                >
                  Select a grocery list
                </label>
                <select
                  className="food-input"
                  value={selectedList}
                  onChange={(e) => setSelectedList(e.target.value)}
                  style={{ width: "100%", fontSize: "1rem" }}
                >
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.store || "Grocery List"} {list._count?.items ? `(${list._count.items} items)` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="food-btn food-btn-primary food-glow"
                onClick={generateCurbside}
                disabled={generating || !selectedList}
                style={{ fontSize: "1.125rem", padding: "0.875rem 2rem" }}
              >
                {generating ? "Generating..." : "Generate Curbside List"}
              </button>

              {error && (
                <p style={{ color: "#ef4444", marginTop: "0.75rem" }}>{error}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="food-enter">
          {/* Summary + Copy All */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1.5rem",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div>
              <span style={{ fontSize: "0.9375rem", color: "var(--food-text)" }}>
                {result.items.length} items across {Object.keys(groupedItems).length} categories
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                className="food-btn food-btn-mint"
                onClick={copyAll}
              >
                {copiedAll ? "Copied! ✓" : "📋 Copy All"}
              </button>
              <button
                className="food-btn food-btn-secondary"
                onClick={() => setResult(null)}
              >
                {"← Change List"}
              </button>
            </div>
          </div>

          {/* Category breakdown */}
          {Object.keys(groupedItems).length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginBottom: "1.5rem",
              }}
            >
              {Object.entries(groupedItems).map(([cat, items]) => (
                <span
                  key={cat}
                  className="food-tag"
                  style={{
                    background: `${categoryColors[cat] || "var(--food-lavender)"}20`,
                    color: categoryColors[cat] || "var(--food-lavender)",
                  }}
                >
                  {cat}: {items.length}
                </span>
              ))}
            </div>
          )}

          {/* Grouped items */}
          {Object.entries(groupedItems).map(([category, items]) => (
            <section key={category} style={{ marginBottom: "1.5rem" }}>
              <div className="food-aisle-header">{category}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {items.map((item, i) => {
                  const globalIdx = result.items.indexOf(item);
                  return (
                    <div
                      key={i}
                      className="food-card"
                      style={{
                        padding: "0.75rem 1rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, color: "var(--food-text)", fontSize: "0.9375rem" }}>
                          {item.searchTerm}
                        </div>
                        {item.quantity && (
                          <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)", marginTop: "0.125rem" }}>
                            {item.quantity} {item.unit || ""}
                          </div>
                        )}
                      </div>
                      <button
                        className="food-btn food-btn-secondary"
                        onClick={() => copyItem(item.searchTerm, globalIdx)}
                        style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem", flexShrink: 0 }}
                      >
                        {copiedIdx === globalIdx ? "Copied! ✓" : "Copy"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Instructions card */}
          <div
            className="food-card"
            style={{
              padding: "1.5rem",
              marginTop: "1.5rem",
              background: "rgba(110, 231, 183, 0.06)",
              border: "1px solid rgba(110, 231, 183, 0.2)",
            }}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.75rem" }}>
              {"📱"} How to use with Walmart Pickup
            </h3>
            <ol
              style={{
                margin: 0,
                paddingLeft: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
                color: "var(--food-text-secondary)",
                fontSize: "0.9375rem",
              }}
            >
              <li>Open the Walmart app or walmart.com</li>
              <li>Tap the search bar and paste/type each item</li>
              <li>Add to cart and adjust quantities as needed</li>
              <li>Schedule your curbside pickup time</li>
              <li>Show up and pop the trunk!</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
