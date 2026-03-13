"use client";

import { useState, useEffect } from "react";
import { POOL_CATEGORIES, formatPoolPrice } from "@/lib/pools";

interface PoolProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  costPrice: number | null;
  retailPrice: number | null;
  imageUrl: string | null;
  brand: string | null;
  unit: string | null;
  size: string | null;
  status: string;
  featured: boolean;
  sortOrder: number;
}

export default function PoolsAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [products, setProducts] = useState<PoolProduct[]>([]);
  const [loading, setLoading] = useState(false);

  // Edit form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    sku: "",
    name: "",
    description: "",
    category: "",
    price: "",
    costPrice: "",
    retailPrice: "",
    imageUrl: "",
    brand: "",
    unit: "",
    size: "",
    featured: false,
    sortOrder: "0",
  });
  const [posting, setPosting] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/pools/items", { method: "POST", body: "{}" })
      .then((r) => {
        if (r.status !== 401) {
          setAuthed(true);
          loadProducts();
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  async function handlePin(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    const res = await fetch("/api/shop/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      setAuthed(true);
      loadProducts();
    } else {
      setPinError("Wrong PIN");
    }
  }

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await fetch("/api/pools/items?status=all");
      const items: PoolProduct[] = await res.json();
      setProducts(
        items.sort((a, b) => {
          if (a.status === "active" && b.status !== "active") return -1;
          if (a.status !== "active" && b.status === "active") return 1;
          return a.sortOrder - b.sortOrder;
        })
      );
    } catch (err) {
      console.error("Failed to load products:", err);
    }
    setLoading(false);
  }

  function resetForm() {
    setForm({
      sku: "",
      name: "",
      description: "",
      category: "",
      price: "",
      costPrice: "",
      retailPrice: "",
      imageUrl: "",
      brand: "",
      unit: "",
      size: "",
      featured: false,
      sortOrder: "0",
    });
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(p: PoolProduct) {
    setForm({
      sku: p.sku,
      name: p.name,
      description: p.description || "",
      category: p.category || "",
      price: String(p.price),
      costPrice: p.costPrice != null ? String(p.costPrice) : "",
      retailPrice: p.retailPrice != null ? String(p.retailPrice) : "",
      imageUrl: p.imageUrl || "",
      brand: p.brand || "",
      unit: p.unit || "",
      size: p.size || "",
      featured: p.featured,
      sortOrder: String(p.sortOrder),
    });
    setEditId(p.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.price || !form.sku) return;
    setPosting(true);
    setSuccess("");

    const payload = {
      sku: form.sku,
      name: form.name,
      description: form.description || undefined,
      category: form.category || undefined,
      price: parseFloat(form.price),
      costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
      retailPrice: form.retailPrice ? parseFloat(form.retailPrice) : undefined,
      imageUrl: form.imageUrl || undefined,
      brand: form.brand || undefined,
      unit: form.unit || undefined,
      size: form.size || undefined,
      featured: form.featured,
      sortOrder: parseInt(form.sortOrder) || 0,
    };

    try {
      const url = editId
        ? `/api/pools/items/${editId}`
        : "/api/pools/items";
      const method = editId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || errBody.error || `HTTP ${res.status}`);
      }

      resetForm();
      setSuccess(editId ? "Product updated!" : "Product created!");
      setTimeout(() => setSuccess(""), 3000);
      loadProducts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert(`Failed: ${msg}`);
    }
    setPosting(false);
  }

  async function toggleStatus(id: string, current: string) {
    const newStatus = current === "active" ? "out-of-stock" : "active";
    await fetch(`/api/pools/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    loadProducts();
  }

  async function toggleFeatured(id: string, current: boolean) {
    await fetch(`/api/pools/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured: !current }),
    });
    loadProducts();
  }

  async function deleteProduct(id: string) {
    if (!confirm("Delete this product?")) return;
    await fetch(`/api/pools/items/${id}`, { method: "DELETE" });
    loadProducts();
  }

  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-cyan-400/40">Loading...</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <form
          onSubmit={handlePin}
          className="w-full max-w-xs rounded-2xl border border-cyan-200 bg-white p-6 text-center shadow-lg"
        >
          <h2 className="text-lg font-bold text-cyan-900">Admin Access</h2>
          <p className="mt-1 text-sm text-slate-400">Enter your PIN</p>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="pools-input mt-4 w-full rounded-lg px-4 py-3 text-center text-2xl tracking-[0.3em]"
            placeholder="••••"
          />
          {pinError && (
            <p className="mt-2 text-sm text-red-500">{pinError}</p>
          )}
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-cyan-600 px-4 py-3 font-bold text-white transition hover:bg-cyan-700"
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  const activeCount = products.filter((p) => p.status === "active").length;
  const featuredCount = products.filter((p) => p.featured).length;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 pb-24">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-cyan-100 bg-white p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-cyan-700">{activeCount}</p>
          <p className="text-xs text-slate-400">Active</p>
        </div>
        <div className="rounded-xl border border-cyan-100 bg-white p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-cyan-500">{featuredCount}</p>
          <p className="text-xs text-slate-400">Featured</p>
        </div>
        <div className="rounded-xl border border-cyan-100 bg-white p-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-slate-400">{products.length}</p>
          <p className="text-xs text-slate-400">Total</p>
        </div>
      </div>

      {success && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-center text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Add / Edit form */}
      {!showForm ? (
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="mt-4 w-full rounded-xl bg-cyan-600 px-4 py-4 text-lg font-bold text-white transition hover:bg-cyan-700"
        >
          + Add Product
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-xl border border-cyan-100 bg-white p-5 shadow-sm"
        >
          <h3 className="font-semibold text-cyan-900">
            {editId ? "Edit Product" : "New Product"}
          </h3>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              placeholder="SKU *"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              required
              disabled={!!editId}
              className="pools-input w-full rounded-lg px-4 py-2.5 disabled:opacity-50"
            />
            <input
              type="text"
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="pools-input w-full rounded-lg px-4 py-2.5"
            />
            <input
              type="number"
              inputMode="decimal"
              placeholder="Sell Price *"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
              className="pools-input w-full rounded-lg px-4 py-2.5"
            />
            <input
              type="number"
              inputMode="decimal"
              placeholder="Cost Price"
              step="0.01"
              min="0"
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              className="pools-input w-full rounded-lg px-4 py-2.5"
            />
            <input
              type="number"
              inputMode="decimal"
              placeholder="Retail Price (comparison)"
              step="0.01"
              min="0"
              value={form.retailPrice}
              onChange={(e) => setForm({ ...form, retailPrice: e.target.value })}
              className="pools-input w-full rounded-lg px-4 py-2.5"
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="pools-input w-full rounded-lg px-4 py-2.5"
            >
              <option value="">Category</option>
              {POOL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Brand"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              className="pools-input w-full rounded-lg px-4 py-2.5"
            />
            <input
              type="text"
              placeholder="Unit (each, bucket, case...)"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="pools-input w-full rounded-lg px-4 py-2.5"
            />
            <input
              type="text"
              placeholder="Size (25lb, 1gal...)"
              value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
              className="pools-input w-full rounded-lg px-4 py-2.5"
            />
            <input
              type="number"
              placeholder="Sort Order"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              className="pools-input w-full rounded-lg px-4 py-2.5"
            />
          </div>

          <input
            type="text"
            placeholder="Image URL"
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            className="pools-input mt-2 w-full rounded-lg px-4 py-2.5"
          />

          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="pools-input mt-2 w-full resize-none rounded-lg px-4 py-2.5"
          />

          <label className="mt-3 flex items-center gap-2 text-sm text-cyan-900">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              className="rounded border-cyan-300"
            />
            Featured product
          </label>

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={posting || !form.name || !form.price || !form.sku}
              className="flex-1 rounded-lg bg-cyan-600 py-3 font-bold text-white transition hover:bg-cyan-700 disabled:opacity-50"
            >
              {posting ? "Saving..." : editId ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-cyan-200 px-4 py-3 text-sm text-slate-500"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Product list */}
      <div className="mt-6 space-y-2">
        {loading && products.length === 0 ? (
          <p className="py-8 text-center text-slate-300">Loading...</p>
        ) : (
          products.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                p.status !== "active"
                  ? "border-slate-200 opacity-50"
                  : "border-cyan-100"
              } bg-white`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-cyan-900">
                  {p.name}
                  {p.featured && (
                    <span className="ml-2 text-xs text-cyan-500">★</span>
                  )}
                  {p.status !== "active" && (
                    <span className="ml-2 text-xs text-red-400 uppercase">
                      {p.status}
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  {p.sku} · {p.category} · {formatPoolPrice(p.price)}
                  {p.costPrice != null && (
                    <span className="text-slate-300">
                      {" "}(cost: {formatPoolPrice(p.costPrice)})
                    </span>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => startEdit(p)}
                  className="rounded-lg border border-cyan-200 px-2.5 py-1 text-xs text-cyan-600 transition hover:bg-cyan-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleStatus(p.id, p.status)}
                  className="rounded-lg border border-cyan-200 px-2.5 py-1 text-xs text-slate-500 transition hover:bg-cyan-50"
                >
                  {p.status === "active" ? "OOS" : "Activate"}
                </button>
                <button
                  onClick={() => toggleFeatured(p.id, p.featured)}
                  className="rounded-lg border border-cyan-200 px-2.5 py-1 text-xs text-yellow-500 transition hover:bg-yellow-50"
                >
                  {p.featured ? "Unfeature" : "Feature"}
                </button>
                <button
                  onClick={() => deleteProduct(p.id)}
                  className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-400 transition hover:bg-red-50"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
