"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PlatformBadge, StatusBadge } from "./PlatformBadge";
import { CrossPostModal } from "./CrossPostModal";
import { EditProductModal } from "./EditProductModal";
import { MarkSoldModal } from "./MarkSoldModal";
import { formatPrice, timeAgo } from "@/lib/shop";

interface ProductListing {
  id: string;
  platform: string;
  price: number;
  status: string;
  externalUrl: string | null;
}

interface ListingJob {
  id: string;
  status: string;
  attempts: number;
  lastError: string | null;
  lastStage: string | null;
  nextAttemptAt: string | null;
  completedAt: string | null;
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
  fbStatus: string | null;
  fbListingId: string | null;
  lastFbCheckAt: string | null;
  shipPrice: number | null;
  weightOz: number | null;
  amazonAsin: string | null;
  goSlug: string | null;
  videoUrl: string | null;
  listings: ProductListing[];
  listingJobs?: ListingJob[];
  postizPostIds?: unknown;
}

export function InventoryTable({
  refreshKey,
  onRefresh,
}: {
  refreshKey: number;
  onRefresh: () => void;
}) {
  const PAGE_SIZE = 100;
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [crossPostProduct, setCrossPostProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [markSoldProduct, setMarkSoldProduct] = useState<Product | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buildQueryUrl(opts?: { cacheBust?: boolean; offset?: number; limit?: number }) {
    const params = new URLSearchParams({
      status: statusFilter,
      limit: String(opts?.limit ?? PAGE_SIZE),
      offset: String(opts?.offset ?? 0),
    });
    if (searchQuery) params.set("q", searchQuery);
    return `/api/shop/products?${params.toString()}${
      opts?.cacheBust ? `&_=${Date.now()}` : ""
    }`;
  }

  useEffect(() => {
    setLoading(true);
    fetch(buildQueryUrl({ offset: 0 }))
      .then((r) => r.json())
      .then((data) => {
        setProducts(data.products || []);
        setTotal(data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    // buildQueryUrl is intentionally omitted — its inputs are tracked below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchQuery, refreshKey]);

  async function loadMore() {
    if (loadingMore || products.length >= total) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        buildQueryUrl({ offset: products.length, cacheBust: true })
      );
      const data = await res.json();
      setProducts((prev) => [...prev, ...(data.products || [])]);
      if (typeof data.total === "number") setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  }

  // Auto-refresh every 8s while any product has an in-flight FB job.
  // Server owns the queue; this just pulls latest status for display.
  useEffect(() => {
    const hasActive = products.some((p) => {
      const j = p.listingJobs?.[0];
      return j && (j.status === "queued" || j.status === "running");
    });
    if (!hasActive) return;
    const interval = setInterval(() => {
      fetch(buildQueryUrl(), { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          setProducts(data.products || []);
          setTotal(data.total || 0);
        })
        .catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, statusFilter, searchQuery]);

  function onSearchChange(next: string) {
    setSearchInput(next);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(next.trim());
    }, 250);
  }

  function clearSearch() {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setSearchInput("");
    setSearchQuery("");
  }

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  async function retryFbJob(productId: string) {
    await fetch(`/api/shop/products/${productId}/listing-job`, {
      method: "POST",
    });
    onRefresh();
  }

  async function deleteProduct(id: string) {
    if (!confirm("Delete this product?")) return;
    await fetch(`/api/shop/products/${id}`, { method: "DELETE" });
    onRefresh();
  }

  async function banFromFbSync(product: { id: string; title: string; fbListingId?: string | null }) {
    const useId = !!product.fbListingId &&
      confirm(
        `Ban this listing from future FB syncs?\n\n` +
        `OK = ban by FB listing ID (only this exact listing).\n` +
        `Cancel = ban by title (any future listing with the same title).`
      );
    const body = useId
      ? {
          pattern: product.fbListingId!,
          matchType: "fbListingId",
          reason: product.title.slice(0, 100),
          archiveExisting: true,
        }
      : (() => {
          if (!confirm(`Ban "${product.title}" from future FB syncs and archive it now?`)) {
            return null;
          }
          return {
            pattern: product.title,
            matchType: "exact",
            archiveExisting: true,
          };
        })();
    if (!body) return;
    const res = await fetch("/api/shop/admin/blocklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Ban failed: ${data?.error || res.status}`);
      return;
    }
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
      {/* Search */}
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <span aria-hidden="true" className="text-base text-white/40">
          🔍
        </span>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search title, description, brand, category…"
          aria-label="Search inventory"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
        />
        {searchInput && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="rounded-full border border-white/15 px-2 py-0.5 text-[0.7rem] text-white/60 hover:border-white/30 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

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
          {searchQuery
            ? `${total} match${total === 1 ? "" : "es"}`
            : `${total} product${total !== 1 ? "s" : ""}`}
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
                  {/* FB queue status */}
                  {product.listingJobs?.[0] && (
                    <FbQueueBadge
                      job={product.listingJobs[0]}
                      onRetry={() => retryFbJob(product.id)}
                    />
                  )}
                  {/* FB Marketplace mirror status */}
                  {product.fbStatus && (
                    <FbMirrorBadge
                      fbStatus={product.fbStatus}
                      lastCheckAt={product.lastFbCheckAt}
                    />
                  )}
                  {/* Treasure Haul Page post status */}
                  <TreasureHaulBadge raw={product.postizPostIds} />
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
                        onClick={() => setEditProduct(product)}
                        className="rounded-lg bg-white/5 border border-white/15 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
                      >
                        Edit
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
                      <a
                        href={`https://www.amazon.com/s?${new URLSearchParams({ k: product.title, tag: "tolley-shop-20" }).toString()}`}
                        target="_blank"
                        rel="nofollow sponsored noopener noreferrer"
                        className="rounded-lg border border-amber-400/30 bg-[#FF9900]/15 px-2.5 py-1 text-xs text-amber-200 hover:bg-[#FF9900]/25"
                        title="Open Amazon search; click + to add to an Idea List on your storefront"
                      >
                        → Amazon
                      </a>
                      <button
                        onClick={() => setEditProduct(product)}
                        className="rounded-lg bg-white/5 border border-white/15 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setMarkSoldProduct(product)}
                        className="shop-btn-sold rounded-lg px-2.5 py-1 text-xs"
                      >
                        Sold
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => banFromFbSync(product)}
                    title="Ban from future FB syncs and archive now"
                    className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/20"
                  >
                    🚫 Ban
                  </button>
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

      {/* Pagination footer */}
      {!loading && products.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-white/50">
          <span>
            Showing <span className="text-white/80">{products.length}</span> of{" "}
            <span className="text-white/80">{total}</span>
            {searchQuery ? <> for "<span className="text-white/70">{searchQuery}</span>"</> : null}
            {statusFilter !== "all" ? <> · {statusFilter}</> : null}
          </span>
          {products.length < total && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-lg border border-purple-400/30 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-200 hover:bg-purple-500/20 disabled:opacity-40"
            >
              {loadingMore ? "Loading…" : `Load ${Math.min(PAGE_SIZE, total - products.length)} more`}
            </button>
          )}
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

      {/* Edit modal */}
      {editProduct && (
        <EditProductModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSaved={() => {
            setEditProduct(null);
            onRefresh();
          }}
        />
      )}

      {/* Mark sold modal — optional buyer-contact capture */}
      {markSoldProduct && (
        <MarkSoldModal
          product={markSoldProduct}
          onClose={() => setMarkSoldProduct(null)}
          onSuccess={() => {
            setMarkSoldProduct(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function FbQueueBadge({
  job,
  onRetry,
}: {
  job: ListingJob;
  onRetry: () => void;
}) {
  const base =
    "mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.65rem]";

  if (job.status === "queued") {
    return (
      <span className={`${base} border-amber-500/30 bg-amber-500/10 text-amber-300`}>
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
        FB queued{job.attempts > 0 ? ` (try ${job.attempts + 1})` : ""}
      </span>
    );
  }

  if (job.status === "running") {
    return (
      <span className={`${base} border-blue-500/30 bg-blue-500/10 text-blue-300`}>
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
        FB drafting…
      </span>
    );
  }

  if (job.status === "done") {
    return (
      <span className={`${base} border-emerald-500/30 bg-emerald-500/10 text-emerald-300`}>
        ✓ FB draft ready
      </span>
    );
  }

  if (job.status === "failed") {
    return (
      <span className="mt-1.5 inline-flex flex-wrap items-center gap-1.5">
        <span className={`${base} border-rose-500/30 bg-rose-500/10 text-rose-300`}>
          ✗ FB failed{job.lastStage ? ` (${job.lastStage})` : ""}
        </span>
        <button
          onClick={onRetry}
          className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[0.65rem] text-white/70 hover:bg-white/10"
          title={job.lastError || "Retry FB draft"}
        >
          Retry
        </button>
      </span>
    );
  }

  return null;
}

/**
 * Mirror-side status: reflects what FB's seller dashboard says about this
 * listing right now (active, pending, sold, in_stock, out_of_stock).
 * Distinct from FbQueueBadge which is about our outbound draft job.
 */
function FbMirrorBadge({
  fbStatus,
  lastCheckAt,
}: {
  fbStatus: string;
  lastCheckAt: string | null;
}) {
  const base =
    "mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.65rem]";
  const ago = lastCheckAt ? timeAgo(new Date(lastCheckAt)) : null;
  const title = `FB Marketplace mirror — synced ${ago ?? "—"}`;

  const styles: Record<string, string> = {
    active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    in_stock: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    pending: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    sold: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    out_of_stock: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
    unknown: "border-white/15 bg-white/5 text-white/50",
  };
  const labels: Record<string, string> = {
    active: "FB: Active",
    in_stock: "FB: In stock",
    pending: "FB: Pending sale",
    sold: "FB: Sold",
    out_of_stock: "FB: Out of stock",
    unknown: "FB: Unknown",
  };
  const cls = styles[fbStatus] || styles.unknown;
  const label = labels[fbStatus] || `FB: ${fbStatus}`;
  return (
    <span className={`${base} ${cls}`} title={title}>
      {label}
    </span>
  );
}

/**
 * Treasure Haul Page post status: reflects whether/when this product has been
 * published on facebook.com/RuthannsTreasureHaul (via the daily cron or the
 * manual admin "Post to Treasure Haul" button). Reads the entry stashed under
 * postizPostIds.treasureHaulPage by /api/shop/admin/post-treasure-haul.
 */
function TreasureHaulBadge({ raw }: { raw: unknown }) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entry = (raw as Record<string, unknown>).treasureHaulPage;
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  const postedAt = typeof e.postedAt === "string" ? e.postedAt : null;
  const url = typeof e.url === "string" ? e.url : null;
  if (!postedAt) return null;
  const ago = timeAgo(new Date(postedAt));
  const inner = (
    <span
      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[0.65rem] text-purple-200"
      title={`Posted to Treasure Haul · ${postedAt}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-300" />
      Treasure Haul · {ago}
    </span>
  );
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}
