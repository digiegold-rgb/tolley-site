"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavLink = { href: string; label: string; emoji: string };

// Primary bottom-tab nav per Claude Design handoff.
const PRIMARY_TABS: NavLink[] = [
  { href: "/food", label: "Home", emoji: "🏠" },
  { href: "/food/recipes", label: "Recipes", emoji: "📖" },
  { href: "/food/plan", label: "Plan", emoji: "📅" },
  { href: "/food/groceries", label: "Grocery", emoji: "🛒" },
];

// Everything else still reachable via the More drawer.
const MORE_LINKS: NavLink[] = [
  { href: "/food/tonight", label: "Tonight", emoji: "🍽️" },
  { href: "/food/cookbooks", label: "Cookbooks", emoji: "📚" },
  { href: "/food/feed", label: "Feed", emoji: "🎬" },
  { href: "/food/pantry", label: "Pantry", emoji: "🗄️" },
  { href: "/food/prep", label: "Meal Prep", emoji: "🧊" },
  { href: "/food/family", label: "Family", emoji: "👨‍👩‍👧‍👦" },
  { href: "/food/scan", label: "Scan", emoji: "📷" },
  { href: "/food/savings", label: "Savings", emoji: "💰" },
  { href: "/food/analytics", label: "Analytics", emoji: "📊" },
];

function isActive(pathname: string, href: string) {
  if (href === "/food") return pathname === "/food";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function FoodNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close drawer on route change.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer open.
  useEffect(() => {
    if (!moreOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [moreOpen]);

  const moreActive = MORE_LINKS.some((l) => isActive(pathname, l.href));

  return (
    <>
      <nav
        aria-label="Kitchen navigation"
        className="fixed bottom-0 left-0 right-0 h-16 bg-food-bg-warm/95 backdrop-blur-xl border-t border-food-border flex z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {PRIMARY_TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-[3px] no-underline"
              aria-current={active ? "page" : undefined}
            >
              <span
                aria-hidden="true"
                className="transition-transform duration-150"
                style={{
                  fontSize: 20,
                  transform: active ? "scale(1.2)" : "scale(1)",
                }}
              >
                {tab.emoji}
              </span>
              <span
                className={`text-[10px] ${
                  active
                    ? "text-food-pink font-semibold"
                    : "text-food-text-secondary font-normal"
                }`}
                style={{ fontFamily: "var(--font-sora), sans-serif" }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-label={moreOpen ? "Close more menu" : "Open more menu"}
          aria-expanded={moreOpen}
          aria-controls="food-nav-more-drawer"
          className="flex-1 flex flex-col items-center justify-center gap-[3px] cursor-pointer bg-transparent border-0"
        >
          <span
            aria-hidden="true"
            className="transition-transform duration-150"
            style={{
              fontSize: 20,
              transform: moreActive || moreOpen ? "scale(1.2)" : "scale(1)",
            }}
          >
            {moreOpen ? "✕" : "☰"}
          </span>
          <span
            className={`text-[10px] ${
              moreActive || moreOpen
                ? "text-food-pink font-semibold"
                : "text-food-text-secondary font-normal"
            }`}
            style={{ fontFamily: "var(--font-sora), sans-serif" }}
          >
            More
          </span>
        </button>
      </nav>

      {moreOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMoreOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        />
      )}

      <aside
        id="food-nav-more-drawer"
        aria-hidden={!moreOpen}
        className={`fixed left-0 right-0 bottom-16 z-50 bg-food-bg-warm border-t border-food-border rounded-t-3xl shadow-[0_-8px_32px_rgba(244,114,182,0.15)] transition-transform duration-300 ${
          moreOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-between items-center px-5 pt-4 pb-2">
          <span
            className="text-food-text font-bold text-base"
            style={{ fontFamily: "var(--font-fredoka), system-ui, sans-serif" }}
          >
            🍳 More
          </span>
          <button
            type="button"
            onClick={() => setMoreOpen(false)}
            aria-label="Close menu"
            className="text-food-text-secondary text-xl px-2 py-1 cursor-pointer bg-transparent border-0"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 p-4 pb-6">
          {MORE_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border no-underline transition-all ${
                  active
                    ? "bg-food-pink/10 border-food-pink/40"
                    : "bg-white border-food-border hover:border-food-pink/30"
                }`}
              >
                <span aria-hidden="true" style={{ fontSize: 22 }}>
                  {link.emoji}
                </span>
                <span
                  className={`text-[11px] text-center ${
                    active
                      ? "text-food-pink font-semibold"
                      : "text-food-text"
                  }`}
                  style={{ fontFamily: "var(--font-sora), sans-serif" }}
                >
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
      </aside>
    </>
  );
}
