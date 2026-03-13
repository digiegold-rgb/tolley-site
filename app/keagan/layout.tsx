"use client";

import { useState, useEffect } from "react";
import { KeeganFooter } from "@/components/keagan/keagan-footer";

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
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-lg p-8 w-80 text-center">
          <h2 className="text-lg font-bold text-gray-900 mb-5">Partnership Hub</h2>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-center text-sm mb-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              autoFocus
            />
            {error && <div className="text-red-500 text-xs mb-2">{error}</div>}
            <button className="w-full px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors shadow-sm">
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-20">
      {children}
      <KeeganFooter />
    </div>
  );
}
