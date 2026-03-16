"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/shop/dashboard", label: "Overview", icon: "📊" },
  { href: "/shop/dashboard/analytics", label: "Analytics", icon: "📈" },
  { href: "/shop/dashboard/trends", label: "Trends", icon: "🔥" },
  { href: "/shop/dashboard/arbitrage", label: "Arbitrage", icon: "💰" },
  { href: "/shop/dashboard/affiliates", label: "Affiliates", icon: "🔗" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/shop/products", { method: "GET" })
      .then(() => fetch("/api/shop/products", { method: "POST", body: "{}" }))
      .then((r) => {
        if (r.status !== 401) setAuthed(true);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  async function handlePin(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    const res = await fetch("/api/shop/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      setAuthed(true);
    } else {
      setPinError("Wrong PIN");
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06050a]">
        <p className="text-white/40">Loading...</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06050a] px-4">
        <form
          onSubmit={handlePin}
          className="shop-pin-card w-full max-w-xs rounded-2xl p-6 text-center"
        >
          <h2 className="text-lg font-bold text-white">Dashboard Access</h2>
          <p className="mt-1 text-sm text-white/40">Enter your PIN</p>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="shop-input mt-4 w-full rounded-lg px-4 py-3 text-center text-2xl tracking-[0.3em]"
            placeholder="••••"
          />
          {pinError && <p className="mt-2 text-sm text-red-400">{pinError}</p>}
          <button type="submit" className="shop-btn-primary mt-4 w-full rounded-lg px-4 py-3">
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#06050a]">
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-white/10 bg-[#06050a]/90 px-4 py-3 backdrop-blur-xl md:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-white/60 hover:text-white"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <span className="text-sm font-bold text-white">
          Shop <span className="text-purple-400">Dashboard</span>
        </span>
        <Link href="/shop" className="text-xs text-white/40 hover:text-white/60">
          Store
        </Link>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-56 transform border-r border-white/10 bg-[#0a0914] transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="hidden border-b border-white/10 px-4 py-4 md:block">
            <Link href="/shop/dashboard" className="text-sm font-bold text-white">
              Shop <span className="text-purple-400">Dashboard</span>
            </Link>
          </div>

          <nav className="mt-16 flex-1 space-y-0.5 px-2 md:mt-2">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-purple-500/15 text-purple-300"
                      : "text-white/50 hover:bg-white/5 hover:text-white/80"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 px-2 py-3">
            <Link
              href="/shop"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/40 hover:bg-white/5 hover:text-white/60"
            >
              <span>🛍️</span> Public Store
            </Link>
            <Link
              href="/shop/admin"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/40 hover:bg-white/5 hover:text-white/60"
            >
              <span>⚙️</span> Legacy Admin
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">{children}</div>
      </main>
    </div>
  );
}
