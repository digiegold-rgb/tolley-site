"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WaterPinGate() {
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
    if (data.ok) {
      router.refresh();
    } else {
      setError(data.error || "Invalid PIN");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <form onSubmit={handleSubmit} className="water-card w-full max-w-sm space-y-4 text-center">
        <div className="text-4xl">🏊‍♂️</div>
        <h1 className="text-xl font-bold">
          <span className="bg-gradient-to-r from-[#00e5c7] to-[#0891b2] bg-clip-text text-transparent">
            Pool Water Dashboard
          </span>
        </h1>
        <p className="text-sm text-white/40">Enter admin PIN to access</p>

        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          className="water-input text-center text-lg tracking-widest"
          autoFocus
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={loading} className="water-btn water-btn-primary w-full justify-center">
          {loading ? "Checking..." : "Enter"}
        </button>
      </form>
    </div>
  );
}
