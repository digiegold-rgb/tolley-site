"use client";

import { useState } from "react";

export default function BuyButton({ itemId }: { itemId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleBuy() {
    setLoading(true);
    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Checkout failed");
      }
    } catch {
      alert("Checkout failed");
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleBuy}
      disabled={loading}
      className="shop-btn-primary w-full rounded-lg py-2.5 text-sm font-semibold"
    >
      {loading ? "Loading..." : "Buy Now"}
    </button>
  );
}
