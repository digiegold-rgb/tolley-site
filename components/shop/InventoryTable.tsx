"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { PlatformBadge, StatusBadge } from "./PlatformBadge";
import { CrossPostModal } from "./CrossPostModal";
import { formatPrice, timeAgo } from "@/lib/shop";

interface ProductListing {
  id: string;
  platform: string;
  price: number;
  status: string;
  externalUrl: string | null;
}

interface Product {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  imageUrls: string[];
  status: string;
  targetPrice: number | null;
  totalCogs: number | null;
  costBasis: number | null;
  netProfit: number | null;
  soldPrice: number | null;
  createdAt: string;
  listings: ProductListing[];
}

export function InventoryTable({
  refreshKey,
  onRefresh,
}: {
  refreshKey: number;
  onRefresh: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [crossPostProduct, setCrossPostProduct] = useState<Product | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/shop/products?status=${statusFilter}&limit=100`)
      .then((r) => r.json())
      .then((data) => {
        setProducts(data.products || []);
        setTotal(data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [statusFilter, refreshKey]);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/shop/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onRefresh();
  }

  async function deleteProduct(id: string) {
    if (!confirm("Delete this product?")) return;
    await fetch(`/api/shop/products/${id}`, { method: "DELETE" });
    onRefresh();
  }

  async function aiEnrich(id: string) {
    const res = await fetch(`/api/shop/products/${id}/ai-enrich`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      alert(`AI Suggestions:\n${JSON.stringify(data.suggestions, null, 2)}`);
      onRefresh();
    } else {
      alert("AI enrichment failed");
    }
  }

  const statuses = ["all", "draft", "listed", "sold", "archived", "returned"];

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              statusFilter === s
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "text-white/40 border border-white/10 hover:bg-white/5"
            }`}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <span className="ml-auto text-xs text-white/30 self-center">
          {total} product{total !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <p className="py-8 text-center text-white/30">Loading...</p>
      ) : products.length === 0 ? (
        <p className="py-8 text-center text-white/30">No products found</p>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
            <div
              key={product.id}
              className={`rounded-xl border p-3 transition ${
                product.status === "sold"
                  ? "border-white/5 bg-white/[0.01] opacity-60"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Thumbnail */}
                {product.imageUrls.length > 0 ? (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={product.imageUrls[0]}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xl">
                    📦
                  </div>
                )}

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="truncate text-sm font-medium text-white">
                      {product.title}
                    </p>
                    <StatusBadge status={product.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {product.targetPrice && (
                      <span className="text-sm font-semibold text-purple-300">
                        {formatPrice(product.targetPrice)}
                      </span>
                    )}
                    {product.totalCogs && (
                      <span className="text-xs text-white/30">
                        COGS: ${product.totalCogs.toFixed(2)}
                      </span>
                    )}
                    {product.category && (
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[0.6rem] text-white/30">
                        {product.category}
                      </span>
                    )}
                  </div>
                  {/* Platform badges */}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {product.listings.map((l) => (
                      <PlatformBadge key={l.id} platform={l.platform} />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-white/20">
                    {timeAgo(new Date(product.createdAt))}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-col gap-1">
                  {product.status === "draft" && (
                    <>
                      <button
                        onClick={() => setCrossPostProduct(product)}
                        className="rounded-lg bg-blue-500/15 border border-blue-500/30 px-2.5 py-1 text-xs text-blue-400 hover:bg-blue-500/25"
                      >
                        List
                      </button>
                      <button
                        onClick={() => aiEnrich(product.id)}
                        className="rounded-lg bg-violet-500/15 border border-violet-500/30 px-2.5 py-1 text-xs text-violet-400 hover:bg-violet-500/25"
                      >
                        AI
                      </button>
                    </>
                  )}
                  {product.status === "listed" && (
                    <>
                      <button
                        onClick={() => setCrossPostProduct(product)}
                        className="rounded-lg bg-blue-500/15 border border-blue-500/30 px-2.5 py-1 text-xs text-blue-400 hover:bg-blue-500/25"
                      >
                        Cross-post
                      </button>
                      <button
                        onClick={() => updateStatus(product.id, "sold")}
                        className="shop-btn-sold rounded-lg px-2.5 py-1 text-xs"
                      >
                        Sold
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => deleteProduct(product.id)}
                    className="shop-btn-delete rounded-lg px-2.5 py-1 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cross-post modal */}
      {crossPostProduct && (
        <CrossPostModal
          product={crossPostProduct}
          onClose={() => setCrossPostProduct(null)}
          onSuccess={() => {
            setCrossPostProduct(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
