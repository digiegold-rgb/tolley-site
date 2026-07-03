"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { formatPoolPrice, getManufacturerUrl } from "@/lib/pools";
import { PoolsAddButton } from "./pools-add-button";

// ─── Engagement Tracking ─────────────────────────────────

function trackPoolEvent(sku: string, event: string, meta?: Record<string, unknown>) {
  // Fire-and-forget, no await needed
  fetch("/api/pools/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku, event, meta }),
  }).catch(() => {});
}

function useInViewTracking(sku: string) {
  const ref = useRef<HTMLDivElement>(null);
  const tracked = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || tracked.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !tracked.current) {
          tracked.current = true;
          trackPoolEvent(sku, "view");
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sku]);

  return ref;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  retailPrice: number | null;
  imageUrl: string | null;
  brand: string | null;
  unit: string | null;
  size: string | null;
  featured: boolean;
  stockStatus: string | null;
  sku: string;
  mfgPart: string | null;
  upc: string | null;
  specs: string | null;
  sortOrder: number;
}

interface Props {
  products: Product[];
  categories: string[];
}

const PAGE_SIZE = 48;

export function PoolsProductGrid({ products, categories }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [activeSize, setActiveSize] = useState<string | null>(null);
  const [activeStock, setActiveStock] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Derive unique brands and sizes from product data
  const brands = useMemo(
    () =>
      [...new Set(products.map((p) => p.brand).filter(Boolean) as string[])].sort(),
    [products],
  );

  const sizes = useMemo(
    () =>
      [...new Set(products.map((p) => p.size).filter(Boolean) as string[])].sort(),
    [products],
  );

  // Filter + OOS sort
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const minP = minPrice ? parseFloat(minPrice) : null;
    const maxP = maxPrice ? parseFloat(maxPrice) : null;

    const result = products.filter((p) => {
      if (activeCategory && p.category !== activeCategory) return false;
      if (activeBrand && p.brand !== activeBrand) return false;
      if (activeSize && p.size !== activeSize) return false;
      if (activeStock) {
        if (activeStock === "in-stock" && p.stockStatus !== "in-stock") return false;
        if (activeStock === "low-stock" && p.stockStatus !== "low-stock") return false;
        if (activeStock === "out-of-stock" && p.stockStatus !== "out-of-stock") return false;
      }
      if (minP !== null && p.price < minP) return false;
      if (maxP !== null && p.price > maxP) return false;
      if (q) {
        const haystack = [p.name, p.brand, p.sku, p.mfgPart, p.upc, p.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    // OOS to bottom, preserve sortOrder within each group
    result.sort((a, b) => {
      const aOos = a.stockStatus === "out-of-stock" ? 1 : 0;
      const bOos = b.stockStatus === "out-of-stock" ? 1 : 0;
      if (aOos !== bOos) return aOos - bOos;
      return a.sortOrder - b.sortOrder;
    });

    return result;
  }, [products, activeCategory, activeBrand, activeSize, activeStock, minPrice, maxPrice, search]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory, activeBrand, activeSize, activeStock, minPrice, maxPrice, search]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const hasFilters =
    activeCategory || activeBrand || activeSize || activeStock || minPrice || maxPrice || search;

  const onFilterChange = useCallback(
    (filter: string, value: string | null) => {
      if (value) trackPoolEvent("_filter", "filter_click", { filter, value });
    },
    [],
  );

  function clearFilters() {
    setActiveCategory(null);
    setActiveBrand(null);
    setActiveSize(null);
    setActiveStock(null);
    setMinPrice("");
    setMaxPrice("");
    setSearch("");
  }

  return (
    <>
      {/* ─── Filters ─── */}
      <div className="mt-4 space-y-3">
        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              activeCategory === null
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
                : "bg-cyan-100 text-cyan-700 hover:bg-cyan-200"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                const next = activeCategory === cat ? null : cat;
                setActiveCategory(next);
                onFilterChange("category", next);
              }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                activeCategory === cat
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
                  : "bg-cyan-100 text-cyan-700 hover:bg-cyan-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search + dropdowns + price range */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, brand, SKU..."
            className="rounded-lg border border-cyan-200 bg-white px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 w-48"
          />

          {brands.length > 1 && (
            <select
              value={activeBrand || ""}
              onChange={(e) => {
                const v = e.target.value || null;
                setActiveBrand(v);
                onFilterChange("brand", v);
              }}
              className="rounded-lg border border-cyan-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-cyan-400 focus:outline-none"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}

          {sizes.length > 1 && (
            <select
              value={activeSize || ""}
              onChange={(e) => setActiveSize(e.target.value || null)}
              className="rounded-lg border border-cyan-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-cyan-400 focus:outline-none"
            >
              <option value="">All Sizes</option>
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 text-sm text-slate-500">
            <span>$</span>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min"
              className="w-16 rounded-lg border border-cyan-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-cyan-400 focus:outline-none"
            />
            <span>–</span>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max"
              className="w-16 rounded-lg border border-cyan-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* Stock status pills */}
          {["in-stock", "low-stock", "out-of-stock"].map((s) => (
            <button
              key={s}
              onClick={() => setActiveStock(activeStock === s ? null : s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                activeStock === s
                  ? s === "in-stock"
                    ? "bg-green-600 text-white"
                    : s === "low-stock"
                      ? "bg-yellow-500 text-white"
                      : "bg-slate-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s === "in-stock" ? "In Stock" : s === "low-stock" ? "Low Stock" : "Out of Stock"}
            </button>
          ))}

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="rounded-full px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Result count */}
        <p className="text-xs text-slate-400">
          {filtered.length} product{filtered.length !== 1 ? "s" : ""}
          {hasFilters ? " matching filters" : ""}
        </p>
      </div>

      {/* ─── Product Grid ─── */}
      <div className="mt-5 grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {filtered.length === 0 ? (
          <p className="col-span-full py-12 text-center text-slate-400">
            {hasFilters
              ? "No products match your filters."
              : "Products coming soon — check back!"}
          </p>
        ) : (
          visible.map((product) => (
            <TrackedProductCard key={product.id} product={product} />
          ))
        )}
      </div>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="rounded-full bg-cyan-600 px-6 py-2 text-sm font-semibold text-white shadow-md shadow-cyan-600/20 transition hover:bg-cyan-700"
          >
            Load More ({filtered.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </>
  );
}

// ─── Tracked Product Card ────────────────────────────────

function TrackedProductCard({ product }: { product: Product }) {
  const viewRef = useInViewTracking(product.sku);
  const savings =
    product.retailPrice && product.retailPrice > product.price
      ? Math.round(product.retailPrice - product.price)
      : null;
  const outOfStock = product.stockStatus === "out-of-stock";

  return (
    <div
      ref={viewRef}
      className={`pools-card flex flex-col overflow-hidden rounded-2xl border bg-white ${
        outOfStock
          ? "border-slate-200 opacity-60 grayscale"
          : "border-[rgba(6,182,212,0.2)]"
      }`}
    >
      {/* Product image — clickable, cyan gradient tile */}
      <Link href={`/pools/${encodeURIComponent(product.sku)}`} className="block">
        <div className="flex h-[120px] items-center justify-center bg-gradient-to-br from-[#ecfeff] to-[#cffafe]">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-auto max-w-full object-contain p-2"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <svg className="h-10 w-10 text-cyan-200" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v13.5A1.5 1.5 0 003.75 21z" />
            </svg>
          )}
        </div>
      </Link>

      {/* Body — p-[14px] per spec */}
      <div className="flex flex-1 flex-col p-[14px]">
        {/* Status badges row */}
        {(outOfStock || product.stockStatus === "low-stock" || (product.featured && !outOfStock)) && (
          <div className="mb-1 flex flex-wrap gap-1">
            {outOfStock && (
              <span className="inline-flex items-center rounded-full bg-slate-400 px-2 py-0.5 text-[10px] font-semibold text-white">
                Out of Stock
              </span>
            )}
            {product.stockStatus === "low-stock" && (
              <span className="inline-flex items-center rounded-full bg-yellow-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                Low Stock
              </span>
            )}
            {product.featured && !outOfStock && product.stockStatus !== "low-stock" && (
              <span className="inline-flex items-center rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                Popular
              </span>
            )}
          </div>
        )}

        {/* Product info */}
        <div className="flex-1">
          <Link href={`/pools/${encodeURIComponent(product.sku)}`} className="block hover:underline">
            <h3 className="mb-1 text-[0.96rem] font-extrabold leading-tight text-[#164e63]">
              {product.name}
            </h3>
          </Link>
          {(product.brand || product.size) && (
            <p className="mt-0.5 text-[10px] text-slate-500">
              {[product.brand, product.size].filter(Boolean).join(" · ")}
            </p>
          )}
          {/* Part numbers */}
          <div className="mt-1 space-y-0.5 text-[10px] text-slate-400">
            {product.mfgPart && (
              <p>
                Mfg#:{" "}
                <a
                  href={getManufacturerUrl(product.brand, product.mfgPart)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackPoolEvent(product.sku, "mfg_link", { brand: product.brand })}
                  className="font-mono text-cyan-600 underline decoration-dotted hover:text-cyan-800"
                  title="View on manufacturer site"
                >
                  {product.mfgPart}
                </a>
              </p>
            )}
            {product.upc && (
              <p>
                UPC:{" "}
                <span className="font-mono text-slate-500">{product.upc}</span>
              </p>
            )}
            <p>
              SKU:{" "}
              <span className="font-mono text-slate-500">{product.sku}</span>
            </p>
          </div>
          {product.description && (
            <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-slate-600">
              {product.description}
            </p>
          )}
          <Link
            href={`/pools/${encodeURIComponent(product.sku)}`}
            className="mt-1 inline-block text-[10px] font-semibold text-cyan-600 hover:text-cyan-800"
          >
            View full details &rarr;
          </Link>
          {product.specs && (
            <details
              className="mt-1"
              onToggle={(e) => {
                if ((e.target as HTMLDetailsElement).open) {
                  trackPoolEvent(product.sku, "spec_expand");
                }
              }}
            >
              <summary className="cursor-pointer text-[10px] font-semibold text-cyan-600 hover:text-cyan-700">
                Specs & Safety
              </summary>
              <p className="mt-0.5 whitespace-pre-line text-[10px] leading-snug text-slate-500">
                {product.specs}
              </p>
            </details>
          )}
        </div>

        {/* Pricing */}
        <div className="mt-2 flex items-end gap-1">
          <span className="text-[1.2rem] font-extrabold text-[#0e7490] mb-2">
            {formatPoolPrice(product.price)}
          </span>
          {savings && product.retailPrice && product.retailPrice > product.price && (
            <span className="mb-2 text-[10px] text-slate-400 line-through">
              {formatPoolPrice(product.retailPrice)}
            </span>
          )}
          {savings && (
            <span className="pools-savings-badge ml-auto mb-2 rounded-full bg-cyan-500/12 px-2 py-0.5 text-[0.68rem] font-bold text-[#0e7490]">
              Save ${savings}
            </span>
          )}
        </div>
        <p className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H6.375c-.621 0-1.125-.504-1.125-1.125v-3.659a3 3 0 00-.879-2.121l-1.308-1.308a1.125 1.125 0 01-.33-.795V6.375c0-.621.504-1.125 1.125-1.125H7.5m10.5 0H21a1.125 1.125 0 011.125 1.125v2.834c0 .3-.12.586-.33.795l-1.308 1.308a3 3 0 00-.879 2.121v3.659c0 .621-.504 1.125-1.125 1.125H18" />
          </svg>
          Free delivery included
        </p>

        {/* Add to cart — full-width, cyan pill w/ glow. Handler untouched. */}
        <div
          className="mt-[10px]"
          onClick={() => { if (!outOfStock) trackPoolEvent(product.sku, "cart_add"); }}
        >
          <PoolsAddButton
            productId={product.id}
            name={product.name}
            price={product.price}
            imageUrl={product.imageUrl}
            outOfStock={outOfStock}
          />
        </div>
      </div>
    </div>
  );
}
