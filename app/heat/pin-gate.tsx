"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function HeatPinGate() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/heat/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json().catch(() => ({}));
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
        background:
          "radial-gradient(1200px 600px at 50% -10%, #2a1848 0%, #120a18 55%, #07050a 100%)",
        color: "white",
        fontFamily: "var(--font-sora), system-ui, sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 360,
          padding: 28,
          borderRadius: 18,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
          tolley.io
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "8px 0 2px" }}>Heat</h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 16 }}>
          Home furnace dashboard
        </p>
        <input
          type="text"
          name="username"
          autoComplete="username"
          defaultValue="heat"
          tabIndex={-1}
          aria-hidden="true"
          readOnly
          style={{ position: "absolute", left: -9999, height: 0, width: 0, opacity: 0 }}
        />
        <label htmlFor="heat-pin" style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>
          PIN
        </label>
        <input
          id="heat-pin"
          name="pin"
          type="password"
          inputMode="text"
          autoComplete="current-password"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError("");
          }}
          placeholder="PIN"
          autoFocus
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "white",
            textAlign: "center",
            letterSpacing: 6,
            fontSize: 18,
          }}
        />
        {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 10 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading || pin.length === 0}
          style={{
            marginTop: 16,
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "none",
            background: loading || pin.length === 0 ? "#4c1d95" : "linear-gradient(90deg,#7c3aed,#c026d3)",
            color: "white",
            fontWeight: 700,
            fontSize: 15,
            cursor: loading || pin.length === 0 ? "default" : "pointer",
          }}
        >
          {loading ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
