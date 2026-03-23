"use client";

import { useState, useEffect, useCallback } from "react";
import type { PoolInventoryItem } from "@/lib/water";

export function WaterInventory() {
  const [items, setItems] = useState<PoolInventoryItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [fItem, setFItem] = useState("");
  const [fCategory, setFCategory] = useState("other");
  const [fUnit, setFUnit] = useState("each");
  const [fThreshold, setFThreshold] = useState("1");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/water/inventory")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function adjustQty(id: string, qty: number, restock = false) {
    await fetch("/api/water/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, quantity: qty, restock }),
    });
    load();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/water/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: fItem, category: fCategory, unit: fUnit, lowStockThreshold: Number(fThreshold) }),
    });
    setFItem("");
    setSaving(false);
    setShowForm(false);
    load();
  }

  const lowStock = items.filter((i) => i.isLowStock);

  return (
    <div className="space-y-6">
      {lowStock.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-amber-400">Low Stock</p>
          <p className="mt-1 text-xs text-amber-300/70">
            {lowStock.map((i) => i.item).join(", ")}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Chemical Inventory</h3>
        <button onClick={() => setShowForm(!showForm)} className="water-btn water-btn-primary">
          {showForm ? "Cancel" : "+ Add Item"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="water-card grid gap-3 sm:grid-cols-4">
          <input value={fItem} onChange={(e) => setFItem(e.target.value)} placeholder="Item name" className="water-input" required />
          <input value={fCategory} onChange={(e) => setFCategory(e.target.value)} placeholder="Category" className="water-input" />
          <input value={fUnit} onChange={(e) => setFUnit(e.target.value)} placeholder="Unit" className="water-input" />
          <div className="flex gap-2">
            <input type="number" value={fThreshold} onChange={(e) => setFThreshold(e.target.value)} placeholder="Low threshold" className="water-input" />
            <button type="submit" disabled={saving} className="water-btn water-btn-primary whitespace-nowrap">Add</button>
          </div>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className={`water-card ${item.isLowStock ? "water-status-warning" : ""}`}>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white/80">{item.item}</h4>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/30">{item.category}</span>
            </div>
            <div className="mb-3 flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${item.isLowStock ? "text-amber-400" : "text-[#00e5c7]"}`}>
                {item.quantity}
              </span>
              <span className="text-sm text-white/40">{item.unit}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => adjustQty(item.id, Math.max(0, item.quantity - 1))}
                className="water-btn water-btn-secondary px-3 py-1 text-xs"
              >
                -1
              </button>
              <button
                onClick={() => adjustQty(item.id, item.quantity + 1)}
                className="water-btn water-btn-secondary px-3 py-1 text-xs"
              >
                +1
              </button>
              <button
                onClick={() => {
                  const qty = prompt("Set quantity to:");
                  if (qty) adjustQty(item.id, Number(qty), true);
                }}
                className="water-btn water-btn-secondary px-3 py-1 text-xs"
              >
                Restock
              </button>
            </div>
            {item.lastRestocked && (
              <p className="mt-2 text-[0.65rem] text-white/20">
                Last restocked: {new Date(item.lastRestocked).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="text-center">
        <a href="/pools" className="text-sm text-[#00e5c7]/70 hover:text-[#00e5c7] underline">
          Buy supplies from Pool Supply Delivery →
        </a>
      </div>
    </div>
  );
}
