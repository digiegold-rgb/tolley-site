"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Same UX as TvPinGate: family enters SHOP_ADMIN_PIN, POST /api/shop/auth
 * sets the shop_admin cookie, one PIN unlocks /tv + /food + shop.
 */
export function FoodPinGate() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/shop/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    if (data.ok) router.refresh();
    else setError(data.error || "Invalid PIN");
    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--food-bg-warm, #fff8f3)",
        color: "var(--food-text, #4a2040)",
        fontFamily: "var(--font-fredoka), system-ui, sans-serif",
        padding: "1.5rem",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 380,
          padding: 28,
          borderRadius: 20,
          background: "white",
          border: "1.5px solid rgba(244, 114, 182, 0.25)",
          boxShadow: "0 12px 40px rgba(74, 32, 64, 0.08)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 44 }}>🍳</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "8px 0 2px" }}>
          Ruthann&apos;s Kitchen
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--food-text-secondary, #9c6b8a)",
            marginBottom: 16,
          }}
        >
          Family PIN unlocks the kitchen — same PIN as Tolley TV
        </p>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(244, 114, 182, 0.06)",
            border: "1px solid rgba(244, 114, 182, 0.25)",
            color: "var(--food-text, #4a2040)",
            textAlign: "center",
            letterSpacing: 6,
            fontSize: 18,
          }}
        />
        {error && (
          <p style={{ color: "#e11d48", fontSize: 13, marginTop: 10 }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="food-btn food-btn-primary"
          style={{
            marginTop: 16,
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "none",
            background: loading
              ? "#f9a8d4"
              : "linear-gradient(90deg, #f472b6, #c084fc)",
            color: "white",
            fontWeight: 700,
            fontSize: 15,
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Checking…" : "Unlock kitchen"}
        </button>
        <p
          style={{
            marginTop: 16,
            fontSize: 13,
            color: "var(--food-text-secondary, #9c6b8a)",
          }}
        >
          Paying subscriber?{" "}
          <Link href="/login?callbackUrl=/food" style={{ color: "#c084fc", fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
