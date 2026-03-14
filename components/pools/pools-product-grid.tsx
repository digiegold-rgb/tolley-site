"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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

export function PoolsProductGrid({ products, categories }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [activeSize, setActiveSize] = useState<string | null>(null);
  const [activeStock, setActiveStock] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [search, setSearch] = useState("");

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
          filtered.map((product) => (
            <TrackedProductCard key={product.id} product={product} />
          ))
        )}
      </div>
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
      className={`flex flex-col rounded-xl border p-3 ${
        outOfStock
          ? "border-slate-200 bg-slate-50 opacity-60 grayscale"
          : "border-cyan-100 bg-cyan-50/30"
      }`}
    >
      {/* Product image */}
      {product.imageUrl && (
        <div className="mb-2 flex items-center justify-center">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-24 w-auto object-contain"
            loading="lazy"
          />
        </div>
      )}

      {/* Out of stock badge */}
      {outOfStock && (
        <span className="mb-1 inline-flex w-fit items-center rounded-full bg-slate-400 px-2 py-0.5 text-[10px] font-semibold text-white">
          Out of Stock
        </span>
      )}

      {/* Low stock badge */}
      {product.stockStatus === "low-stock" && (
        <span className="mb-1 inline-flex w-fit items-center rounded-full bg-yellow-500 px-2 py-0.5 text-[10px] font-semibold text-white">
          Low Stock
        </span>
      )}

      {/* Featured badge */}
      {product.featured && !outOfStock && product.stockStatus !== "low-stock" && (
        <span className="mb-1 inline-flex w-fit items-center rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-semibold text-white">
          Popular
        </span>
      )}

      {/* Product info */}
      <div className="flex-1">
        <h3 className="text-xs font-bold leading-tight text-cyan-900">
          {product.name}
        </h3>
        {(product.brand || product.size) && (
          <p className="mt-0.5 text-[10px] text-slate-400">
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
        <span className="text-lg font-extrabold text-cyan-700">
          {formatPoolPrice(product.price)}
        </span>
        {product.retailPrice && (
          <span className="text-[10px] text-slate-400 line-through">
            {formatPoolPrice(product.retailPrice)}
          </span>
        )}
        {savings && (
          <span className="pools-savings-badge ml-auto rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
            -${savings}
          </span>
        )}
      </div>

      {/* Add to cart — track via wrapper */}
      <div onClick={() => { if (!outOfStock) trackPoolEvent(product.sku, "cart_add"); }}>
        <PoolsAddButton
          productId={product.id}
          name={product.name}
          price={product.price}
          imageUrl={product.imageUrl}
          outOfStock={outOfStock}
        />
      </div>
    </div>
  );
}
