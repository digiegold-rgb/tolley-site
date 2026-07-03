"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface CategoryStripItem {
  name: string;
  count: number;
}

export interface CategoryStripProps {
  categories: ReadonlyArray<CategoryStripItem>;
  active: string | null;
}

export default function CategoryStrip({ categories, active }: CategoryStripProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeRef = useRef<HTMLButtonElement | null>(null);

  const sorted = useMemo(() => {
    return [...categories].sort((a, b) => b.count - a.count);
  }, [categories]);

  const totalCount = useMemo(
    () => sorted.reduce((sum, c) => sum + c.count, 0),
    [sorted]
  );

  useEffect(() => {
    if (activeRef.current) {
      try {
        activeRef.current.scrollIntoView({ inline: "center", block: "nearest" });
      } catch {
        // older browsers may throw on scrollIntoView options — degrade silently
        activeRef.current.scrollIntoView();
      }
    }
  }, [active]);

  function setCat(next: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === null) {
      params.delete("cat");
    } else {
      params.set("cat", next);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleClick(name: string) {
    if (active === name) {
      setCat(null);
    } else {
      setCat(name);
    }
  }

  return (
    <div className="shop-category-strip -mx-4 mb-3 overflow-x-auto px-4 py-1">
      <div className="flex snap-x gap-2">
        <button
          type="button"
          ref={active === null ? activeRef : null}
          onClick={() => setCat(null)}
          aria-pressed={active === null}
          className={`shop-category-pill ${active === null ? "is-active" : ""}`}
        >
          <span>All</span>
          {totalCount > 0 && (
            <span className="shop-category-count">({totalCount})</span>
          )}
        </button>
        {sorted.map((cat) => {
          const isActive = active === cat.name;
          return (
            <button
              key={cat.name}
              type="button"
              ref={isActive ? activeRef : null}
              onClick={() => handleClick(cat.name)}
              aria-pressed={isActive}
              className={`shop-category-pill ${isActive ? "is-active" : ""}`}
            >
              <span>{cat.name}</span>
              <span className="shop-category-count">({cat.count})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
