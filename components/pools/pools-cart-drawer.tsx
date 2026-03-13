"use client";

import { useState } from "react";
import { usePoolsCart } from "./pools-cart-provider";
import { formatPoolPrice } from "@/lib/pools";

export function PoolsCartDrawer() {
  const { cart, removeFromCart, updateQty, clearCart, cartTotal, cartCount } =
    usePoolsCart();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  async function handleCheckout() {
    if (cart.length === 0) return;
    setChecking(true);
    try {
      const res = await fetch("/api/pools/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (data.url) {
        clearCart();
        window.location.href = data.url;
      } else {
        alert(data.error || "Checkout failed");
      }
    } catch {
      alert("Checkout failed. Please try again.");
    }
    setChecking(false);
  }

  return (
    <>
      {/* Floating cart button */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed right-5 bottom-20 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-600 text-white shadow-lg transition-all hover:bg-cyan-700 hover:scale-105 ${
          cartCount > 0 ? "pools-glow" : ""
        }`}
        aria-label={`Cart (${cartCount} items)`}
      >
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
          />
        </svg>
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-cyan-700">
            {cartCount}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyan-100 px-5 py-4">
          <h2 className="text-lg font-bold text-cyan-900">
            Your Cart ({cartCount})
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <svg className="h-16 w-16 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              <p className="font-medium">Your cart is empty</p>
              <p className="mt-1 text-sm">Browse our pool supplies to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center gap-3 rounded-xl border border-cyan-100 bg-cyan-50/30 p-3"
                >
                  {/* Product info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-cyan-900">
                      {item.name}
                    </p>
                    <p className="text-sm font-bold text-cyan-600">
                      {formatPoolPrice(item.price)}
                    </p>
                  </div>

                  {/* Qty controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        updateQty(item.productId, item.quantity - 1)
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-200 text-sm text-cyan-700 transition hover:bg-cyan-100"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-semibold text-cyan-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQty(item.productId, item.quantity + 1)
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-200 text-sm text-cyan-700 transition hover:bg-cyan-100"
                    >
                      +
                    </button>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="text-slate-300 transition hover:text-red-400"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="border-t border-cyan-100 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Subtotal</span>
              <span className="text-lg font-bold text-cyan-900">
                {formatPoolPrice(cartTotal)}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Delivery included in all prices. No extra fees.
            </p>
            <button
              onClick={handleCheckout}
              disabled={checking}
              className="pools-glow w-full rounded-xl bg-cyan-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-cyan-700 disabled:opacity-50"
            >
              {checking ? "Processing..." : "Checkout"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
