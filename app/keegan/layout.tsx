"use client";

import { useState, useEffect } from "react";
import { KeeganFooter } from "@/components/keegan/keegan-footer";

export default function KeeganLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/wd/clients")
      .then(r => {
        if (r.ok) { setAuthed(true); }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/wd/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      setAuthed(true);
    } else {
      setError("Invalid PIN");
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-lg p-6 w-72 text-center">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Partnership Hub</h2>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-center text-sm mb-2"
              autoFocus
            />
            {error && <div className="text-red-500 text-xs mb-2">{error}</div>}
            <button className="w-full px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded hover:bg-gray-800">
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {children}
      <KeeganFooter />
    </div>
  );
}
