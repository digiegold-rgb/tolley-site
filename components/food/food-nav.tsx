"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/food", label: "Kitchen", emoji: "🏠" },
  { href: "/food/tonight", label: "Tonight", emoji: "🍽️" },
  { href: "/food/recipes", label: "Recipes", emoji: "📖" },
  { href: "/food/cookbooks", label: "Cookbooks", emoji: "📚" },
  { href: "/food/feed", label: "Feed", emoji: "🎬" },
  { href: "/food/plan", label: "Meal Plan", emoji: "📅" },
  { href: "/food/groceries", label: "Groceries", emoji: "🛒" },
  { href: "/food/pantry", label: "Pantry", emoji: "🗄️" },
  { href: "/food/prep", label: "Meal Prep", emoji: "🧊" },
  { href: "/food/family", label: "Family", emoji: "👨‍👩‍👧‍👦" },
  { href: "/food/scan", label: "Scan", emoji: "📷" },
  { href: "/food/savings", label: "Savings", emoji: "💰" },
  { href: "/food/analytics", label: "Analytics", emoji: "📊" },
];

export function FoodNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/food") return pathname === "/food";
    return pathname.startsWith(href);
  };

  return (
    <nav className="food-nav">
      <Link href="/food" className="food-nav-logo" style={{ textDecoration: "none", color: "white" }}>
        🍳 Ruthann's Kitchen
      </Link>
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={isActive(link.href) ? "active" : ""}
        >
          {link.emoji} {link.label}
        </Link>
      ))}
    </nav>
  );
}
