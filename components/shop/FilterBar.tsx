"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ShopSort } from "@/lib/shop/filters";

export interface FilterBarInitial {
  minCents: number | null;
  maxCents: number | null;
  pickup: boolean;
  ship: boolean;
  sort: ShopSort;
}

export interface FilterBarProps {
  initial: FilterBarInitial;
  resultCount: number;
}

const SORT_OPTIONS: ReadonlyArray<{ value: ShopSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "az", label: "A–Z" },
  { value: "price_asc", label: "Price: low → high" },
  { value: "price_desc", label: "Price: high → low" },
];

function centsToDollarString(cents: number | null): string {
  if (cents === null) return "";
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

export default function FilterBar({ initial, resultCount }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [minStr, setMinStr] = useState<string>(centsToDollarString(initial.minCents));
  const [maxStr, setMaxStr] = useState<string>(centsToDollarString(initial.maxCents));
  const [pickup, setPickup] = useState<boolean>(initial.pickup);
  const [ship, setShip] = useState<boolean>(initial.ship);
  const [sort, setSort] = useState<ShopSort>(initial.sort);

  // Re-sync from URL when navigation happens externally (category click,
  // Clear filters, browser back). React's recommended "store info from
  // previous renders" pattern: track previous prop in state and reset
  // controlled fields when it shifts.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevInitial, setPrevInitial] = useState<FilterBarInitial>(initial);
  if (
    prevInitial.minCents !== initial.minCents ||
    prevInitial.maxCents !== initial.maxCents ||
    prevInitial.pickup !== initial.pickup ||
    prevInitial.ship !== initial.ship ||
    prevInitial.sort !== initial.sort
  ) {
    setPrevInitial(initial);
    setMinStr(centsToDollarString(initial.minCents));
    setMaxStr(centsToDollarString(initial.maxCents));
    setPickup(initial.pickup);
    setShip(initial.ship);
    setSort(initial.sort);
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushParams = useCallback(
    (overrides: {
      min?: string | null;
      max?: string | null;
      pickup?: boolean;
      ship?: boolean;
      sort?: ShopSort;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      const apply = (key: string, val: string | null | undefined) => {
        if (val === undefined) return;
        if (val === null || val === "") params.delete(key);
        else params.set(key, val);
      };

      apply("min", overrides.min);
      apply("max", overrides.max);

      if (overrides.pickup !== undefined) {
        if (overrides.pickup) params.set("pickup", "1");
        else params.delete("pickup");
      }
      if (overrides.ship !== undefined) {
        if (overrides.ship) params.set("ship", "1");
        else params.delete("ship");
      }
      if (overrides.sort !== undefined) {
        if (overrides.sort === "newest") params.delete("sort");
        else params.set("sort", overrides.sort);
      }

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  function debouncedPriceUpdate(nextMin: string, nextMax: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Validate: drop invalid (non-numeric / negative) by sending null
      const minVal = nextMin.trim() === "" ? null : sanitize(nextMin);
      const maxVal = nextMax.trim() === "" ? null : sanitize(nextMax);
      pushParams({ min: minVal, max: maxVal });
    }, 350);
  }

  function sanitize(raw: string): string | null {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    if (n < 0) return null;
    return String(n);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const anyFilterSet =
    minStr.trim() !== "" ||
    maxStr.trim() !== "" ||
    pickup ||
    ship ||
    sort !== "newest";

  function clearAll() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setMinStr("");
    setMaxStr("");
    setPickup(false);
    setShip(false);
    setSort("newest");
    pushParams({
      min: null,
      max: null,
      pickup: false,
      ship: false,
      sort: "newest",
    });
  }

  const bothChecked = pickup && ship;

  return (
    <div className="shop-filter-bar mb-4 flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          <span className="text-white/50">$ Min</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={minStr}
            placeholder="0"
            onChange={(e) => {
              const v = e.target.value;
              setMinStr(v);
              debouncedPriceUpdate(v, maxStr);
            }}
            className="shop-input w-20 rounded-md px-2 py-1 text-xs"
            aria-label="Minimum price (dollars)"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-white/50">$ Max</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={maxStr}
            placeholder="∞"
            onChange={(e) => {
              const v = e.target.value;
              setMaxStr(v);
              debouncedPriceUpdate(minStr, v);
            }}
            className="shop-input w-20 rounded-md px-2 py-1 text-xs"
            aria-label="Maximum price (dollars)"
          />
        </label>

        <label className="flex items-center gap-1.5 text-white/70">
          <input
            type="checkbox"
            checked={pickup}
            onChange={(e) => {
              setPickup(e.target.checked);
              pushParams({ pickup: e.target.checked });
            }}
            className="h-3.5 w-3.5 accent-purple-500"
          />
          <span>Local pickup only</span>
        </label>

        <label className="flex items-center gap-1.5 text-white/70">
          <input
            type="checkbox"
            checked={ship}
            onChange={(e) => {
              setShip(e.target.checked);
              pushParams({ ship: e.target.checked });
            }}
            className="h-3.5 w-3.5 accent-purple-500"
          />
          <span>Has shipping</span>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-white/50">Sort</span>
          <select
            value={sort}
            onChange={(e) => {
              const next = e.target.value as ShopSort;
              setSort(next);
              pushParams({ sort: next });
            }}
            className="shop-input rounded-md px-2 py-1 text-xs"
            aria-label="Sort order"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#0c0b14]">
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {anyFilterSet && (
          <button
            type="button"
            onClick={clearAll}
            className="rounded-md border border-white/15 px-2 py-1 text-[0.7rem] text-white/70 hover:border-white/30 hover:text-white"
          >
            Clear filters
          </button>
        )}

        <div className="ml-auto text-[0.7rem] text-white/50">
          Showing {resultCount} item{resultCount !== 1 ? "s" : ""}
        </div>
      </div>

      {bothChecked && (
        <p className="text-[0.65rem] text-white/40">
          Both pickup + shipping checked = show everything
        </p>
      )}
    </div>
  );
}
