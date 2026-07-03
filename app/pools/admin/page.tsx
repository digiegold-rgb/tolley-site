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
  priceOverride: boolean;
}

interface CompetitorEntry {
  price: number;
  scannedAt: string;
  matchType: string;
  url: string | null;
}

interface PriceChange {
  id: string;
  sku: string;
  oldPrice: number;
  newPrice: number;
  costPrice: number;
  reason: string;
  competitors: Record<string, number> | null;
  margin: number;
  createdAt: string;
}

interface PoolOrder {
  id: string;
  amount: number;
  status: string;
  customerEmail: string | null;
  customerName: string | null;
  items: { name: string; quantity: number; price: number }[];
  createdAt: string;
}

type AdminTab = "products" | "orders" | "pricing" | "changelog" | "sync";

export default function PoolsAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [products, setProducts] = useState<PoolProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("products");

  // Orders state
  const [orders, setOrders] = useState<PoolOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Pricing intel state
  const [competitorData, setCompetitorData] = useState<Record<string, Record<string, CompetitorEntry>>>({});
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);

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

  // Sync log state
  interface SyncRun {
    id: string;
    status: string;
    itemsFound: number;
    duration: number | null;
    error: string | null;
    startedAt: string;
    completedAt: string | null;
    meta: Record<string, unknown> | null;
  }
  interface SyncActivityEntry {
    id: string;
    event: string;
    title: string;
    severity: string;
    meta: Record<string, unknown> | null;
    createdAt: string;
  }
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [auditRuns, setAuditRuns] = useState<SyncRun[]>([]);
  const [syncActivity, setSyncActivity] = useState<SyncActivityEntry[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);

  // Inline price editing
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  async function saveManualPrice(productId: string) {
    const newPrice = parseFloat(editPriceValue);
    if (isNaN(newPrice) || newPrice <= 0) return;
    setSavingPrice(true);
    try {
      const res = await fetch(`/api/pools/items/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: newPrice, priceOverride: true }),
      });
      if (res.ok) {
        setEditingPriceId(null);
        setEditPriceValue("");
        loadProducts();
        if (activeTab === "pricing") loadCompetitorData();
      }
    } catch (err) {
      console.error("Failed to save price:", err);
    }
    setSavingPrice(false);
  }

  async function clearPriceOverride(productId: string) {
    try {
      await fetch(`/api/pools/items/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceOverride: false }),
      });
      loadProducts();
    } catch (err) {
      console.error("Failed to clear override:", err);
    }
  }

  // Pricing filters
  const [pricingFilter, setPricingFilter] = useState<"all" | "has_data" | "needs_attention">("all");
  const [pricingCategory, setPricingCategory] = useState("");
  const [pricingSearch, setPricingSearch] = useState("");

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

  useEffect(() => {
    if (!authed) return;
    if (activeTab === "pricing" || activeTab === "changelog") {
      loadCompetitorData();
    }
    if (activeTab === "orders") {
      loadOrders();
    }
    if (activeTab === "sync") {
      loadSyncLog();
    }
  }, [authed, activeTab]);

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

  async function loadOrders() {
    setOrdersLoading(true);
    try {
      const res = await fetch("/api/pools/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Failed to load orders:", err);
    }
    setOrdersLoading(false);
  }

  async function loadSyncLog() {
    setSyncLoading(true);
    try {
      const res = await fetch("/api/pools/sync-log");
      if (res.ok) {
        const data = await res.json();
        setSyncRuns(data.runs || []);
        setAuditRuns(data.auditRuns || []);
        setSyncActivity(data.activity || []);
      }
    } catch (err) {
      console.error("Failed to load sync log:", err);
    }
    setSyncLoading(false);
  }

  async function loadCompetitorData() {
    setPricingLoading(true);
    try {
      const res = await fetch("/api/pools/competitor-prices");
      if (res.ok) {
        const data = await res.json();
        setCompetitorData(data.competitorPrices || {});
        setPriceChanges(data.recentChanges || []);
      }
    } catch (err) {
      console.error("Failed to load competitor data:", err);
    }
    setPricingLoading(false);
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
    setActiveTab("products");
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

  // ── Auth gates ──

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

  // ── Computed values ──

  const activeCount = products.filter((p) => p.status === "active").length;
  const featuredCount = products.filter((p) => p.featured).length;
  const competitorCoverageCount = Object.keys(competitorData).length;

  const COMPETITORS = ["leslies", "intheswim", "walmart", "amazon", "homedepot"] as const;
  const COMPETITOR_LABELS: Record<string, string> = {
    leslies: "Leslie's",
    intheswim: "InTheSwim",
    walmart: "Walmart",
    amazon: "Amazon",
    homedepot: "Home Depot",
  };

  function getCompetitorStatus(p: PoolProduct): "green" | "yellow" | "red" | "gray" {
    const cd = competitorData[p.sku];
    if (!cd || Object.keys(cd).length === 0) return "gray";
    const minComp = Math.min(...Object.values(cd).map((c) => c.price));
    if (minComp <= 0) return "gray";
    const gap = ((minComp - p.price) / minComp) * 100;
    if (gap >= 10) return "green";
    if (gap >= 5) return "yellow";
    return "red";
  }

  const filteredPricingProducts = products
    .filter((p) => p.status === "active" && p.costPrice != null)
    .filter((p) => {
      if (pricingFilter === "has_data") return !!competitorData[p.sku];
      if (pricingFilter === "needs_attention") {
        const status = getCompetitorStatus(p);
        return status === "red" || status === "yellow";
      }
      return true;
    })
    .filter((p) => !pricingCategory || p.category === pricingCategory)
    .filter((p) => {
      if (!pricingSearch) return true;
      const q = pricingSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brand || "").toLowerCase().includes(q)
      );
    });

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 pb-24">
      {/* Stats row */}
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

      {/* Tab Navigation */}
      <div className="mt-5 flex gap-1 rounded-xl border border-cyan-100 bg-cyan-50/50 p-1">
        {([
          { key: "products" as AdminTab, label: "Products" },
          { key: "orders" as AdminTab, label: "Orders" },
          { key: "pricing" as AdminTab, label: "Pricing Intel" },
          { key: "changelog" as AdminTab, label: "Price Log" },
          { key: "sync" as AdminTab, label: "Sync Log" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              activeTab === tab.key
                ? "bg-white text-cyan-700 shadow-sm"
                : "text-slate-500 hover:text-cyan-600"
            }`}
          >
            {tab.label}
            {tab.key === "orders" && orders.length > 0 && (
              <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                {orders.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════ Products Tab ═══════════════ */}
      {activeTab === "products" && (
        <>
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
        </>
      )}

      {/* ═══════════════ Orders Tab ═══════════════ */}
      {activeTab === "orders" && (
        <div className="mt-4">
          {ordersLoading ? (
            <p className="py-12 text-center text-slate-300">Loading orders...</p>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-lg font-semibold text-slate-400">No orders yet</p>
              <p className="mt-1 text-sm text-slate-300">
                Orders will appear here when customers check out on tolley.io/pools
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-cyan-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-cyan-900">
                        {formatPoolPrice(order.amount / 100)}
                        <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          order.status === "complete" || order.status === "paid"
                            ? "bg-green-100 text-green-700"
                            : order.status === "expired"
                              ? "bg-slate-100 text-slate-400"
                              : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {order.status.toUpperCase()}
                        </span>
                      </p>
                      {(order.customerName || order.customerEmail) && (
                        <p className="mt-0.5 text-sm text-slate-500">
                          {order.customerName}
                          {order.customerEmail && (
                            <span className="text-slate-400"> · {order.customerEmail}</span>
                          )}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {new Date(order.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {order.items.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {order.items.map((item, i) => (
                        <p key={i} className="text-xs text-slate-500">
                          {item.quantity}x {item.name}
                          <span className="text-slate-400"> · {formatPoolPrice(item.price / 100)}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ Pricing Intel Tab ═══════════════ */}
      {activeTab === "pricing" && (
        <div className="mt-4">
          {/* Competitor coverage stat */}
          {competitorCoverageCount > 0 && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-center">
              <p className="text-sm font-semibold text-green-700">
                {competitorCoverageCount} products with competitor data
              </p>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pricingFilter}
              onChange={(e) => setPricingFilter(e.target.value as typeof pricingFilter)}
              className="pools-input rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Products</option>
              <option value="has_data">Has Competitor Data</option>
              <option value="needs_attention">Needs Attention</option>
            </select>
            <select
              value={pricingCategory}
              onChange={(e) => setPricingCategory(e.target.value)}
              className="pools-input rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Categories</option>
              {POOL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Search..."
              value={pricingSearch}
              onChange={(e) => setPricingSearch(e.target.value)}
              className="pools-input flex-1 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {pricingLoading ? (
            <p className="py-12 text-center text-slate-300">Loading competitor data...</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-cyan-100 text-slate-500">
                    <th className="pb-2 pr-2 font-semibold">Product</th>
                    <th className="pb-2 px-2 text-right font-semibold">Cost</th>
                    <th className="pb-2 px-2 text-right font-semibold">Ours</th>
                    <th className="pb-2 px-2 text-right font-semibold">Margin</th>
                    {COMPETITORS.map((c) => (
                      <th key={c} className="pb-2 px-2 text-right font-semibold">
                        {COMPETITOR_LABELS[c]}
                      </th>
                    ))}
                    <th className="pb-2 pl-2 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPricingProducts.map((p) => {
                    const cd = competitorData[p.sku] || {};
                    const marginPct = p.costPrice
                      ? Math.round(((p.price - p.costPrice) / p.price) * 100)
                      : null;
                    const status = getCompetitorStatus(p);
                    const statusColors = {
                      green: "bg-green-100 text-green-700",
                      yellow: "bg-yellow-100 text-yellow-700",
                      red: "bg-red-100 text-red-700",
                      gray: "bg-slate-100 text-slate-400",
                    };
                    const statusLabels = {
                      green: "10%+ under",
                      yellow: "5-10% under",
                      red: "At risk",
                      gray: "No data",
                    };

                    return (
                      <tr key={p.id} className="border-b border-cyan-50 hover:bg-cyan-50/30">
                        <td className="py-2 pr-2">
                          <p className="font-medium text-cyan-900 truncate max-w-[200px]">
                            {p.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {p.sku} · {p.brand}
                          </p>
                        </td>
                        <td className="py-2 px-2 text-right text-slate-500">
                          {p.costPrice != null ? formatPoolPrice(p.costPrice) : "—"}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {editingPriceId === p.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-slate-400">$</span>
                              <input
                                type="number"
                                step="1"
                                value={editPriceValue}
                                onChange={(e) => setEditPriceValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveManualPrice(p.id);
                                  if (e.key === "Escape") setEditingPriceId(null);
                                }}
                                autoFocus
                                className="w-16 rounded border border-cyan-300 px-1 py-0.5 text-right text-xs font-bold text-cyan-700"
                              />
                              <button
                                onClick={() => saveManualPrice(p.id)}
                                disabled={savingPrice}
                                className="rounded bg-cyan-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-cyan-700"
                              >
                                {savingPrice ? "..." : "OK"}
                              </button>
                              <button
                                onClick={() => setEditingPriceId(null)}
                                className="rounded px-1 py-0.5 text-[10px] text-slate-400 hover:text-slate-600"
                              >
                                X
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingPriceId(p.id);
                                setEditPriceValue(String(p.price));
                              }}
                              className="group inline-flex items-center gap-1 font-bold text-cyan-700 hover:text-cyan-500"
                              title="Click to edit price"
                            >
                              {formatPoolPrice(p.price)}
                              <span className="text-[9px] text-transparent group-hover:text-cyan-400">&#9998;</span>
                            </button>
                          )}
                          {p.priceOverride && editingPriceId !== p.id && (
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <span className="rounded bg-purple-100 px-1 py-0 text-[9px] font-bold text-purple-700">MANUAL</span>
                              <button
                                onClick={() => clearPriceOverride(p.id)}
                                className="text-[9px] text-slate-400 hover:text-red-500"
                                title="Remove override — let dynamic pricing manage this"
                              >
                                clear
                              </button>
                            </div>
                          )}
                        </td>
                        <td className={`py-2 px-2 text-right font-semibold ${
                          marginPct != null && marginPct < 20
                            ? "text-red-500"
                            : "text-green-600"
                        }`}>
                          {marginPct != null ? `${marginPct}%` : "—"}
                        </td>
                        {COMPETITORS.map((comp) => {
                          const entry = cd[comp];
                          if (!entry) {
                            return (
                              <td key={comp} className="py-2 px-2 text-right text-slate-300">
                                —
                              </td>
                            );
                          }
                          const isCheaper = entry.price < p.price;
                          return (
                            <td
                              key={comp}
                              className={`py-2 px-2 text-right ${
                                isCheaper
                                  ? "text-red-500 font-semibold"
                                  : "text-slate-500"
                              }`}
                            >
                              {entry.url ? (
                                <a
                                  href={entry.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline decoration-dotted"
                                >
                                  {formatPoolPrice(entry.price)}
                                </a>
                              ) : (
                                formatPoolPrice(entry.price)
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 pl-2 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColors[status]}`}
                          >
                            {statusLabels[status]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredPricingProducts.length === 0 && (
                <p className="py-8 text-center text-slate-300">
                  {pricingFilter === "has_data"
                    ? "No products with competitor data yet. The scan runs daily at 5 AM."
                    : "No products match filters."}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ Price Log Tab ═══════════════ */}
      {/* ═══════════════ Sync Log Tab ═══════════════ */}
      {activeTab === "sync" && (
        <div className="mt-4 space-y-4">
          {syncLoading ? (
            <p className="py-12 text-center text-slate-300">Loading sync history...</p>
          ) : (
            <>
              {/* Pool360 Price Sync (the real scraper) */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-cyan-800">Pool360 Price Sync (4 AM Daily)</h3>
                <p className="text-[11px] text-slate-400">Playwright scrapes Pool360 catalog, syncs prices + stock to DB</p>
                {syncRuns.length === 0 ? (
                  <p className="py-6 text-center text-slate-300">No Pool360 sync runs recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-cyan-100 text-slate-500">
                          <th className="pb-2 pr-2 font-semibold">Date</th>
                          <th className="pb-2 px-2 font-semibold">Time</th>
                          <th className="pb-2 px-2 text-center font-semibold">Status</th>
                          <th className="pb-2 px-2 text-right font-semibold">Synced</th>
                          <th className="pb-2 px-2 text-right font-semibold">Duration</th>
                          <th className="pb-2 pl-2 font-semibold">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {syncRuns.map((run) => {
                          const d = new Date(run.startedAt);
                          const durationMin = run.duration ? Math.round(run.duration / 60000) : null;
                          const durationSec = run.duration ? Math.round(run.duration / 1000) : null;
                          const durationStr = durationMin && durationMin >= 1
                            ? `${durationMin}m`
                            : durationSec != null && durationSec > 0
                              ? `${durationSec}s`
                              : "—";
                          return (
                            <tr key={run.id} className={`border-b border-cyan-50 ${run.status === "failed" ? "bg-red-50" : ""}`}>
                              <td className="py-2 pr-2 text-slate-600 whitespace-nowrap font-medium">
                                {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                              </td>
                              <td className="py-2 px-2 text-slate-400 whitespace-nowrap">
                                {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {run.status === "complete" ? (
                                  <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">OK</span>
                                ) : run.status === "failed" ? (
                                  <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">FAIL</span>
                                ) : run.status === "running" ? (
                                  <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">RUN</span>
                                ) : (
                                  <span className="text-slate-400">{run.status}</span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-cyan-700">
                                {run.itemsFound > 0 ? run.itemsFound.toLocaleString() : "—"}
                              </td>
                              <td className="py-2 px-2 text-right text-slate-400">
                                {durationStr}
                              </td>
                              <td className="py-2 pl-2 text-red-500 truncate max-w-[200px]" title={run.error || ""}>
                                {run.error || ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Stock Audit (3 AM) */}
              {auditRuns.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-cyan-800">Stock Audit (3 AM Daily)</h3>
                  <p className="text-[11px] text-slate-400">DB-only check — counts OOS/low-stock products, no scraping</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-cyan-100 text-slate-500">
                          <th className="pb-2 pr-2 font-semibold">Date</th>
                          <th className="pb-2 px-2 text-center font-semibold">Status</th>
                          <th className="pb-2 px-2 text-right font-semibold">Total in DB</th>
                          <th className="pb-2 pl-2 font-semibold">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditRuns.slice(0, 14).map((run) => {
                          const d = new Date(run.startedAt);
                          return (
                            <tr key={run.id} className="border-b border-cyan-50">
                              <td className="py-1.5 pr-2 text-slate-600 whitespace-nowrap">
                                {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                {run.status === "complete" ? (
                                  <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">OK</span>
                                ) : (
                                  <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">FAIL</span>
                                )}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono text-slate-500">
                                {run.itemsFound.toLocaleString()}
                              </td>
                              <td className="py-1.5 pl-2 text-red-500 truncate max-w-[200px]">
                                {run.error || ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Activity feed */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-cyan-800">Recent Activity</h3>
                {syncActivity.length === 0 ? (
                  <p className="py-4 text-center text-slate-300">No activity recorded.</p>
                ) : (
                  <div className="space-y-1">
                    {syncActivity.slice(0, 30).map((a) => {
                      const d = new Date(a.createdAt);
                      const sevColor =
                        a.severity === "alert" ? "text-red-600 bg-red-50 border-red-100" :
                        a.severity === "warning" ? "text-yellow-700 bg-yellow-50 border-yellow-100" :
                        a.severity === "success" ? "text-green-700 bg-green-50 border-green-100" :
                        "text-slate-600 bg-slate-50 border-slate-100";
                      return (
                        <div key={a.id} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${sevColor}`}>
                          <span className="shrink-0 text-[10px] text-slate-400 whitespace-nowrap">
                            {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                            {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </span>
                          <span className="font-medium">{a.title}</span>
                          {a.meta && typeof a.meta === "object" && "created" in a.meta && (
                            <span className="ml-auto shrink-0 text-[10px] text-slate-400">
                              +{String(a.meta.created)} new / {String(a.meta.updated)} upd
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "changelog" && (
        <div className="mt-4">
          {pricingLoading ? (
            <p className="py-12 text-center text-slate-300">Loading price changes...</p>
          ) : priceChanges.length === 0 ? (
            <p className="py-12 text-center text-slate-300">
              No price changes yet. Changes will appear after the first competitor scan.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-cyan-100 text-slate-500">
                    <th className="pb-2 pr-2 font-semibold">Date</th>
                    <th className="pb-2 px-2 font-semibold">SKU</th>
                    <th className="pb-2 px-2 text-right font-semibold">Old</th>
                    <th className="pb-2 px-2 text-center font-semibold"></th>
                    <th className="pb-2 px-2 text-right font-semibold">New</th>
                    <th className="pb-2 px-2 font-semibold">Reason</th>
                    <th className="pb-2 px-2 text-right font-semibold">Margin</th>
                    <th className="pb-2 pl-2 font-semibold">Competitors</th>
                  </tr>
                </thead>
                <tbody>
                  {priceChanges.map((c) => {
                    const direction =
                      c.newPrice > c.oldPrice
                        ? "up"
                        : c.newPrice < c.oldPrice
                          ? "down"
                          : "same";
                    const reasonLabels: Record<string, string> = {
                      competitor_undercut: "Competitor undercut",
                      margin_floor: "Margin floor",
                      no_data_fallback: "No data (45%)",
                      stale_data_fallback: "Stale data (45%)",
                      initial_set: "Initial set",
                    };
                    const isFlagged = c.reason.startsWith("FLAGGED_");
                    const displayReason = isFlagged
                      ? reasonLabels[c.reason.replace("FLAGGED_", "")] || c.reason
                      : reasonLabels[c.reason] || c.reason;

                    return (
                      <tr
                        key={c.id}
                        className={`border-b border-cyan-50 ${isFlagged ? "bg-yellow-50" : ""}`}
                      >
                        <td className="py-2 pr-2 text-slate-400 whitespace-nowrap">
                          {new Date(c.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                          <span className="ml-1 text-[10px]">
                            {new Date(c.createdAt).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-mono text-cyan-700">
                          {c.sku}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-500">
                          {formatPoolPrice(c.oldPrice)}
                        </td>
                        <td
                          className={`py-2 px-2 text-center text-lg ${
                            direction === "up"
                              ? "text-red-400"
                              : direction === "down"
                                ? "text-green-500"
                                : "text-slate-300"
                          }`}
                        >
                          {direction === "up" ? "↑" : direction === "down" ? "↓" : "="}
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-cyan-700">
                          {formatPoolPrice(c.newPrice)}
                        </td>
                        <td className="py-2 px-2">
                          {isFlagged && (
                            <span className="mr-1 rounded bg-yellow-200 px-1 text-[10px] font-bold text-yellow-800">
                              REVIEW
                            </span>
                          )}
                          <span className="text-slate-600">{displayReason}</span>
                        </td>
                        <td
                          className={`py-2 px-2 text-right font-semibold ${
                            c.margin < 20 ? "text-red-500" : "text-green-600"
                          }`}
                        >
                          {c.margin}%
                        </td>
                        <td className="py-2 pl-2 text-[10px] text-slate-400">
                          {c.competitors
                            ? Object.entries(c.competitors)
                                .map(
                                  ([k, v]) =>
                                    `${COMPETITOR_LABELS[k] || k}: $${v}`
                                )
                                .join(", ")
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
