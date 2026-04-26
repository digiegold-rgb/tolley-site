"use client";

import Link from "next/link";

interface FoodHeroProps {
  userName: string;
  weekSummary: { planned: number; cooked: number };
  expiringCount: number;
  groceryCount: number;
}

export function FoodHero({ userName, weekSummary, expiringCount, groceryCount }: FoodHeroProps) {
  const stats = [
    { label: "Planned", value: weekSummary.planned, emoji: "📅" },
    { label: "Cooked", value: weekSummary.cooked, emoji: "👩‍🍳" },
    { label: "Expiring Soon", value: expiringCount, emoji: "⏰" },
    { label: "Grocery Items", value: groceryCount, emoji: "🛒" },
  ];

  const quickActions = [
    { label: "Plan Meals", href: "/food/plan", emoji: "📅", style: "food-btn food-btn-primary" },
    { label: "Browse Recipes", href: "/food/recipes", emoji: "📖", style: "food-btn food-btn-secondary" },
    { label: "Scan Receipt", href: "/food/scan", emoji: "📷", style: "food-btn food-btn-secondary" },
    { label: "Check Pantry", href: "/food/pantry", emoji: "🗄️", style: "food-btn food-btn-mint" },
  ];

  return (
    <section className="food-enter" style={{ padding: "2rem 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "0.5rem" }}>
        Hey {userName}! 💕
      </h1>
      <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem" }}>
        Here's what's happening in your kitchen this week
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="food-card"
            style={{ padding: "1rem", textAlign: "center" }}
          >
            <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>{stat.emoji}</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--food-pink)" }}>
              {stat.value}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href} className={action.style}>
            {action.emoji} {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
