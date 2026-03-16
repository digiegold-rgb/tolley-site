"use client";

import { useState, useEffect } from "react";

interface AffiliateLink {
  id: string;
  network: string;
  productUrl: string;
  affiliateUrl: string;
  shortCode: string;
  title: string | null;
  category: string | null;
  clicks: number;
  conversions: number;
  revenue: number;
  isActive: boolean;
  createdAt: string;
}

const NETWORKS = [
  { value: "amazon_associates", label: "Amazon Associates" },
  { value: "ebay_partner", label: "eBay Partner Network" },
  { value: "shareasale", label: "ShareASale" },
];

export function AffiliateManager() {
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [network, setNetwork] = useState("amazon_associates");
  const [productUrl, setProductUrl] = useState("");
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadLinks();
  }, []);

  async function loadLinks() {
    setLoading(true);
    try {
      const res = await fetch("/api/shop/affiliate?active=false");
      if (res.ok) setLinks(await res.json());
    } catch {
      // silent
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!productUrl || !affiliateUrl || !shortCode) return;
    setPosting(true);

    try {
      const res = await fetch("/api/shop/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network,
          productUrl,
          affiliateUrl,
          shortCode,
          title: title || undefined,
          category: category || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      setShowForm(false);
      setProductUrl("");
      setAffiliateUrl("");
      setShortCode("");
      setTitle("");
      setCategory("");
      loadLinks();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : "Unknown"}`);
    }
    setPosting(false);
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/shop/affiliate/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    loadLinks();
  }

  async function deleteLink(id: string) {
    if (!confirm("Delete this affiliate link?")) return;
    await fetch(`/api/shop/affiliate/${id}`, { method: "DELETE" });
    loadLinks();
  }

  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
  const totalConversions = links.reduce((s, l) => s + l.conversions, 0);
  const totalRevenue = links.reduce((s, l) => s + l.revenue, 0);

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <p className="text-xs text-white/30">Clicks</p>
          <p className="text-xl font-bold text-blue-400">{totalClicks}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <p className="text-xs text-white/30">Conversions</p>
          <p className="text-xl font-bold text-green-400">{totalConversions}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <p className="text-xs text-white/30">Revenue</p>
          <p className="text-xl font-bold text-purple-400">${totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      {/* Add button */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="shop-btn-primary w-full rounded-xl py-3 text-sm"
        >
          + New Affiliate Link
        </button>
      ) : (
        <form onSubmit={handleCreate} className="rounded-xl border border-white/12 bg-white/[0.04] p-4 space-y-2">
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            className="shop-input w-full rounded-lg px-4 py-2.5 text-sm"
          >
            {NETWORKS.map((n) => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="shop-input w-full rounded-lg px-4 py-2.5 text-sm"
          />
          <input
            type="url"
            placeholder="Product URL"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            required
            className="shop-input w-full rounded-lg px-4 py-2.5 text-sm"
          />
          <input
            type="url"
            placeholder="Affiliate URL"
            value={affiliateUrl}
            onChange={(e) => setAffiliateUrl(e.target.value)}
            required
            className="shop-input w-full rounded-lg px-4 py-2.5 text-sm"
          />
          <div className="flex gap-2">
            <div className="flex items-center gap-1 flex-1">
              <span className="text-xs text-white/30 whitespace-nowrap">tolley.io/go/</span>
              <input
                type="text"
                placeholder="code"
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
                required
                className="shop-input flex-1 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <input
              type="text"
              placeholder="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="shop-input w-32 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={posting} className="shop-btn-primary flex-1 rounded-lg py-2.5 text-sm">
              {posting ? "Creating..." : "Create"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-white/50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Links list */}
      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="py-4 text-center text-white/30 text-sm">Loading...</p>
        ) : links.length === 0 ? (
          <p className="py-4 text-center text-white/30 text-sm">No affiliate links yet</p>
        ) : (
          links.map((link) => (
            <div
              key={link.id}
              className={`rounded-xl border p-3 ${
                link.isActive ? "border-white/10 bg-white/[0.03]" : "border-white/5 bg-white/[0.01] opacity-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {link.title || link.shortCode}
                  </p>
                  <p className="text-xs text-purple-400">
                    tolley.io/go/{link.shortCode}
                  </p>
                  <p className="text-[0.65rem] text-white/20 capitalize mt-0.5">
                    {link.network.replace(/_/g, " ")}
                    {link.category ? ` / ${link.category}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className="text-blue-400">{link.clicks} clicks</span>
                  <span className="text-green-400">${link.revenue.toFixed(2)}</span>
                  <button
                    onClick={() => toggleActive(link.id, link.isActive)}
                    className={`rounded px-2 py-1 text-[0.6rem] ${
                      link.isActive
                        ? "bg-green-500/15 text-green-400"
                        : "bg-white/5 text-white/30"
                    }`}
                  >
                    {link.isActive ? "Active" : "Paused"}
                  </button>
                  <button
                    onClick={() => deleteLink(link.id)}
                    className="text-red-400/50 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
