"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface PantryItem {
  id: string;
  name: string;
  location: string;
  quantity: number;
  unit?: string;
  expiresAt?: string;
  status: string;
  category?: string;
  autoRestock: boolean;
}

const LOCATIONS = [
  { key: "fridge", label: "Fridge", emoji: "🧊" },
  { key: "pantry", label: "Pantry", emoji: "🥫" },
  { key: "freezer", label: "Freezer", emoji: "❄️" },
  { key: "spice_rack", label: "Spice Rack", emoji: "🧂" },
];

const CATEGORIES = ["produce", "dairy", "meat", "grains", "canned", "snacks", "condiments", "spices", "beverages", "baking", "frozen", "other"];
const UNITS = ["", "oz", "lb", "g", "kg", "cups", "tbsp", "tsp", "liters", "ml", "count", "bags", "boxes", "cans", "bottles"];

interface RestockItem {
  id: string;
  name: string;
  isChecked: boolean;
}

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLocation, setActiveLocation] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restockItems, setRestockItems] = useState<RestockItem[]>([]);
  const [showRestock, setShowRestock] = useState(false);
  const [markingOut, setMarkingOut] = useState<string | null>(null);
  const [editingQty, setEditingQty] = useState<string | null>(null);
  const [editQtyValue, setEditQtyValue] = useState("");

  const handleUpdateQuantity = async (itemId: string, newQty: number) => {
    if (newQty < 0) newQty = 0;
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, quantity: newQty, status: newQty === 0 ? "out_of_stock" : newQty <= 1 ? "low" : "in_stock" } : i));
    await fetch(`/api/food/pantry/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: newQty, status: newQty === 0 ? "out_of_stock" : newQty <= 1 ? "low" : "in_stock" }),
    });
  };

  // New item form
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("pantry");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newUnit, setNewUnit] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/food/pantry");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRestock = useCallback(async () => {
    try {
      const res = await fetch("/api/food/pantry/restock");
      if (res.ok) {
        const data = await res.json();
        setRestockItems((data.items || []).map((i: any) => ({ id: i.id, name: i.name, isChecked: false })));
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchItems();
    fetchRestock();
  }, [fetchItems, fetchRestock]);

  const handleMarkOut = async (item: PantryItem) => {
    setMarkingOut(item.id);
    try {
      await fetch("/api/food/pantry/restock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, itemName: item.name }),
      });
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: "out_of_stock", quantity: 0 } : i));
      setRestockItems((prev) => {
        if (prev.some((r) => r.name.toLowerCase() === item.name.toLowerCase())) return prev;
        return [...prev, { id: item.id, name: item.name, isChecked: false }];
      });
    } catch {}
    setMarkingOut(null);
  };

  const handleAddItem = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/food/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          location: newLocation,
          quantity: parseFloat(newQuantity) || 1,
          unit: newUnit || undefined,
          expiresAt: newExpiry || undefined,
          category: newCategory || undefined,
        }),
      });
      if (res.ok) {
        setNewName("");
        setNewQuantity("1");
        setNewUnit("");
        setNewExpiry("");
        setNewCategory("");
        setShowAddForm(false);
        fetchItems();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    try {
      await fetch(`/api/food/pantry/${itemId}`, { method: "DELETE" });
    } catch {
      fetchItems();
    }
  };

  const filteredItems = activeLocation === "all" ? items : items.filter((i) => i.location === activeLocation);

  const locationCounts = LOCATIONS.reduce<Record<string, number>>((acc, loc) => {
    acc[loc.key] = items.filter((i) => i.location === loc.key).length;
    return acc;
  }, {});

  const getExpiryClass = (expiresAt?: string): string => {
    if (!expiresAt) return "";
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return "food-expiry-urgent";
    if (days <= 3) return "food-expiry-urgent";
    if (days <= 7) return "food-expiry-soon";
    return "food-expiry-ok";
  };

  const getExpiryText = (expiresAt?: string): string => {
    if (!expiresAt) return "";
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Expired";
    if (days === 1) return "Expires tomorrow";
    if (days <= 7) return `${days} days left`;
    return new Date(expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", animation: "food-sparkle 1.5s ease-in-out infinite" }}>🗄️</div>
        <p style={{ color: "var(--food-text-secondary)", marginTop: "1rem" }}>Loading pantry...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div
        className="food-enter"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--food-text)" }}>
          Pantry
        </h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className={`food-btn ${showRestock ? "food-btn-primary" : "food-btn-secondary"}`}
            onClick={() => setShowRestock(!showRestock)}
            style={{ position: "relative" }}
          >
            🛒 Restock {restockItems.length > 0 && (
              <span style={{ background: "var(--food-pink)", color: "white", borderRadius: "50%", width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.6875rem", fontWeight: 700, marginLeft: "0.375rem" }}>
                {restockItems.length}
              </span>
            )}
          </button>
          <Link href="/food/scan" className="food-btn food-btn-secondary">
            Quick Scan
          </Link>
          <button
            className="food-btn food-btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? "Cancel" : "+ Add Item"}
          </button>
        </div>
      </div>

      {/* Restock List */}
      {showRestock && (
        <div className="food-card food-enter" style={{ padding: "1.25rem", marginBottom: "1.5rem", borderColor: "var(--food-pink)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)" }}>
              🛒 We&apos;re Out! — Restock List
            </h3>
            <button
              className="food-btn food-btn-secondary"
              style={{ fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}
              onClick={() => {
                const text = restockItems.map((i) => `- ${i.name}`).join("\n");
                navigator.clipboard.writeText(text);
              }}
            >
              Copy List
            </button>
          </div>
          {restockItems.length === 0 ? (
            <p style={{ color: "var(--food-text-secondary)", fontSize: "0.875rem", textAlign: "center", padding: "1rem" }}>
              Nothing on the restock list yet! Tap &quot;We&apos;re Out!&quot; on any pantry item to add it here.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {restockItems.map((item) => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0", borderBottom: "1px solid rgba(244,114,182,0.08)" }}>
                  <input
                    type="checkbox"
                    className="food-check"
                    checked={item.isChecked}
                    onChange={() => setRestockItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isChecked: !i.isChecked } : i))}
                  />
                  <span style={{ fontWeight: 500, color: "var(--food-text)", textDecoration: item.isChecked ? "line-through" : "none", opacity: item.isChecked ? 0.5 : 1, flex: 1 }}>
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <Link href="/food/curbside" className="food-btn food-btn-mint" style={{ flex: 1, justifyContent: "center", textDecoration: "none", textAlign: "center" }}>
              🚗 Walmart Curbside
            </Link>
            <Link href="/food/groceries" className="food-btn food-btn-secondary" style={{ flex: 1, justifyContent: "center", textDecoration: "none", textAlign: "center" }}>
              📝 Full Grocery List
            </Link>
          </div>
        </div>
      )}

      {/* Add item form */}
      {showAddForm && (
        <div
          className="food-card food-enter"
          style={{ padding: "1.25rem", marginBottom: "1.5rem" }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            Add Pantry Item
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <input
              className="food-input"
              placeholder="Item name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ gridColumn: "1 / -1" }}
            />
            <select
              className="food-input"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
            >
              {LOCATIONS.map((loc) => (
                <option key={loc.key} value={loc.key}>{loc.emoji} {loc.label}</option>
              ))}
            </select>
            <select
              className="food-input"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            >
              <option value="">Category (optional)</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                className="food-input"
                type="number"
                placeholder="Qty"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                style={{ width: "80px" }}
              />
              <select
                className="food-input"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">Unit</option>
                {UNITS.filter(Boolean).map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <input
              className="food-input"
              type="date"
              placeholder="Expiry date"
              value={newExpiry}
              onChange={(e) => setNewExpiry(e.target.value)}
            />
          </div>
          <button
            className="food-btn food-btn-primary"
            onClick={handleAddItem}
            disabled={!newName.trim() || saving}
            style={{ marginTop: "1rem", opacity: !newName.trim() || saving ? 0.6 : 1 }}
          >
            {saving ? "Adding..." : "Add to Pantry"}
          </button>
        </div>
      )}

      {/* Location tabs */}
      <div
        className="food-enter"
        style={{ display: "flex", gap: "0.375rem", marginBottom: "1rem", overflowX: "auto", "--enter-delay": "0.1s" } as React.CSSProperties}
      >
        <button
          className={`food-tab ${activeLocation === "all" ? "active" : ""}`}
          onClick={() => setActiveLocation("all")}
        >
          All
          <span className="food-tag food-tag-pink" style={{ marginLeft: "0.375rem" }}>
            {items.length}
          </span>
        </button>
        {LOCATIONS.map((loc) => (
          <button
            key={loc.key}
            className={`food-tab ${activeLocation === loc.key ? "active" : ""}`}
            onClick={() => setActiveLocation(loc.key)}
          >
            {loc.emoji} {loc.label}
            <span className="food-tag food-tag-lavender" style={{ marginLeft: "0.375rem" }}>
              {locationCounts[loc.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Pantry grid */}
      {filteredItems.length === 0 ? (
        <div
          className="food-card food-enter"
          style={{ textAlign: "center", padding: "4rem 2rem", "--enter-delay": "0.15s" } as React.CSSProperties}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>
            {activeLocation === "all" ? "🗄️" : LOCATIONS.find((l) => l.key === activeLocation)?.emoji || "🗄️"}
          </div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>
            {activeLocation === "all" ? "Your pantry is empty" : `Nothing in the ${LOCATIONS.find((l) => l.key === activeLocation)?.label.toLowerCase() || "pantry"}`}
          </h3>
          <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem" }}>
            Add items manually or scan your groceries to populate your inventory.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button className="food-btn food-btn-primary" onClick={() => setShowAddForm(true)}>
              Add Item
            </button>
            <Link href="/food/scan" className="food-btn food-btn-secondary">
              Scan Groceries
            </Link>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "1rem",
          }}
        >
          {filteredItems.map((item, i) => (
            <div
              key={item.id}
              className="food-card food-enter"
              style={{
                padding: "1rem",
                position: "relative",
                "--enter-delay": `${0.03 * i}s`,
              } as React.CSSProperties}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                <div>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.25rem" }}>
                    {item.name}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "var(--food-text-secondary)", marginTop: "0.25rem" }}>
                    {editingQty === item.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <input
                          className="food-input"
                          type="number"
                          value={editQtyValue}
                          onChange={(e) => setEditQtyValue(e.target.value)}
                          onBlur={() => {
                            const val = parseFloat(editQtyValue);
                            if (!isNaN(val)) handleUpdateQuantity(item.id, val);
                            setEditingQty(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = parseFloat(editQtyValue);
                              if (!isNaN(val)) handleUpdateQuantity(item.id, val);
                              setEditingQty(null);
                            }
                            if (e.key === "Escape") setEditingQty(null);
                          }}
                          autoFocus
                          style={{ width: 60, padding: "0.25rem 0.375rem", fontSize: "0.8125rem", textAlign: "center" }}
                        />
                        <span style={{ fontSize: "0.75rem" }}>{item.unit || ""}</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          style={{
                            width: 24, height: 24, borderRadius: "50%", border: "1.5px solid var(--food-border)",
                            background: "white", color: "var(--food-pink)", fontWeight: 700, fontSize: "0.875rem",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "var(--font-fredoka), sans-serif",
                          }}
                        >−</button>
                        <span
                          onClick={() => { setEditingQty(item.id); setEditQtyValue(String(item.quantity)); }}
                          style={{ minWidth: 28, textAlign: "center", cursor: "pointer", fontWeight: 600, color: "var(--food-text)", padding: "0.125rem 0.25rem", borderRadius: "0.25rem" }}
                          title="Tap to edit quantity"
                        >
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          style={{
                            width: 24, height: 24, borderRadius: "50%", border: "1.5px solid var(--food-border)",
                            background: "white", color: "var(--food-mint)", fontWeight: 700, fontSize: "0.875rem",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "var(--font-fredoka), sans-serif",
                          }}
                        >+</button>
                        <span style={{ fontSize: "0.75rem", marginLeft: "0.125rem" }}>{item.unit || ""}</span>
                      </div>
                    )}
                    {item.category && <span className="food-tag food-tag-mint">{item.category}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  style={{ background: "none", border: "none", color: "var(--food-text-secondary)", cursor: "pointer", fontSize: "1rem", padding: "0" }}
                >
                  &times;
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.75rem" }}>
                <span style={{ fontSize: "0.75rem" }}>
                  {LOCATIONS.find((l) => l.key === item.location)?.emoji}{" "}
                  {LOCATIONS.find((l) => l.key === item.location)?.label}
                </span>
                {item.expiresAt && (
                  <span className={getExpiryClass(item.expiresAt)} style={{ fontSize: "0.75rem" }}>
                    {getExpiryText(item.expiresAt)}
                  </span>
                )}
              </div>

              {item.status === "low" && (
                <div className="food-tag food-tag-peach" style={{ position: "absolute", top: "0.5rem", right: "2rem", fontSize: "0.6875rem" }}>
                  Low
                </div>
              )}
              {item.status === "out_of_stock" && (
                <div className="food-tag food-tag-pink" style={{ position: "absolute", top: "0.5rem", right: "2rem", fontSize: "0.6875rem" }}>
                  Out
                </div>
              )}

              {/* Quick actions */}
              <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.75rem" }}>
                {item.status !== "out_of_stock" && (
                  <button
                    onClick={() => handleMarkOut(item)}
                    disabled={markingOut === item.id}
                    style={{
                      flex: 1, padding: "0.375rem", borderRadius: "0.5rem", border: "1.5px solid rgba(244,114,182,0.3)",
                      background: "rgba(244,114,182,0.05)", color: "var(--food-pink)", fontSize: "0.75rem", fontWeight: 600,
                      cursor: "pointer", fontFamily: "var(--font-fredoka), sans-serif",
                      opacity: markingOut === item.id ? 0.5 : 1,
                    }}
                  >
                    {markingOut === item.id ? "..." : "We're Out!"}
                  </button>
                )}
                {item.status !== "low" && item.status !== "out_of_stock" && (
                  <button
                    onClick={async () => {
                      await fetch(`/api/food/pantry/${item.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "low" }),
                      });
                      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: "low" } : i));
                    }}
                    style={{
                      flex: 1, padding: "0.375rem", borderRadius: "0.5rem", border: "1.5px solid rgba(253,186,116,0.3)",
                      background: "rgba(253,186,116,0.05)", color: "var(--food-peach)", fontSize: "0.75rem", fontWeight: 600,
                      cursor: "pointer", fontFamily: "var(--font-fredoka), sans-serif",
                    }}
                  >
                    Running Low
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
