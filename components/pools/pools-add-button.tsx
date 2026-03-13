"use client";

import { useState } from "react";
import { usePoolsCart } from "./pools-cart-provider";

interface Props {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
}

export function PoolsAddButton({ productId, name, price, imageUrl }: Props) {
  const { addToCart } = usePoolsCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addToCart({ productId, name, price, imageUrl });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
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
