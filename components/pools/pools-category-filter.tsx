"use client";

import { useState } from "react";

export function PoolsCategoryFilter({ categories }: { categories: string[] }) {
  const [active, setActive] = useState<string | null>(null);

  function handleFilter(category: string | null) {
    setActive(category);
    const grid = document.querySelector(".pools-product-grid");
    if (!grid) return;
    const cards = grid.querySelectorAll<HTMLElement>("[data-category]");
    cards.forEach((card) => {
      if (!category || card.dataset.category === category) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        onClick={() => handleFilter(null)}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
          active === null
            ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
            : "bg-cyan-100 text-cyan-700 hover:bg-cyan-200"
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => handleFilter(cat)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            active === cat
              ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
              : "bg-cyan-100 text-cyan-700 hover:bg-cyan-200"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
