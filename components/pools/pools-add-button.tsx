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
        className="mt-3 w-full cursor-not-allowed rounded-lg bg-slate-300 px-4 py-2.5 text-sm font-bold text-slate-500"
      >
        Out of Stock
      </button>
    );
  }

  return (
    <button
      onClick={handleAdd}
      className={`mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${
        added
          ? "pools-splash bg-green-500 text-white"
          : "bg-cyan-600 text-white hover:bg-cyan-700"
      }`}
    >
      {added ? "Added!" : "Add to Cart"}
    </button>
  );
}
