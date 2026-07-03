"use client";

import { useState } from "react";
import { usePoolsCart } from "./pools-cart-provider";

interface Props {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  outOfStock?: boolean;
}

export function PoolsAddButton({ productId, name, price, imageUrl, outOfStock }: Props) {
  const { addToCart } = usePoolsCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    if (outOfStock) return;
    addToCart({ productId, name, price, imageUrl });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  if (outOfStock) {
    return (
      <button
        disabled
        className="w-full cursor-not-allowed rounded-full bg-slate-300 px-4 py-2.5 text-[0.9rem] font-bold text-slate-500"
      >
        Out of Stock
      </button>
    );
  }

  return (
    <button
      onClick={handleAdd}
      className={`pools-glow w-full rounded-full px-4 py-2.5 text-[0.9rem] font-bold text-white transition-all ${
        added
          ? "pools-splash bg-emerald-500"
          : "bg-cyan-500 hover:bg-cyan-600"
      }`}
    >
      {added ? "Added!" : "Add to Cart"}
    </button>
  );
}
