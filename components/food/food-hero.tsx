"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface FoodHeroProps {
  userName: string;
}

const FILTER_CHIPS: { label: string; href: string }[] = [
  { label: "Quick (≤30 min)", href: "/food/recipes?filter=quick" },
  { label: "Family-style", href: "/food/recipes?filter=family" },
  { label: "Use pantry", href: "/food/tonight" },
];

function deriveGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function FoodHero({ userName }: FoodHeroProps) {
  // Greeting derived on client to match the user's local time-of-day.
  // Use a stable initial value during SSR to avoid hydration mismatch.
  const [greeting, setGreeting] = useState("Hey");

  useEffect(() => {
    setGreeting(deriveGreeting());
  }, []);

  return (
    <section
      className="relative overflow-hidden food-enter"
      style={{
        background: "linear-gradient(135deg, #f472b6, #c084fc)",
        padding: "28px 20px 36px",
      }}
    >
      <div
        aria-hidden="true"
        className="absolute"
        style={{
          top: -30,
          right: -20,
          width: 140,
          height: 140,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute"
        style={{
          bottom: -40,
          left: 30,
          width: 90,
          height: 90,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
        }}
      />

      <p
        className="text-white/85 mb-1 relative"
        style={{
          fontSize: 13,
          fontFamily: "var(--font-sora), sans-serif",
        }}
      >
        {greeting}, {userName} 👋
      </p>
      <h1
        className="text-white relative"
        style={{
          fontFamily: "var(--font-fredoka), system-ui, sans-serif",
          fontSize: 26,
          fontWeight: 700,
          lineHeight: 1.15,
          margin: 0,
        }}
      >
        What&rsquo;s for<br />dinner tonight?
      </h1>

      <div
        className="relative flex flex-wrap"
        style={{ marginTop: 14, gap: 8 }}
      >
        {FILTER_CHIPS.map((chip) => (
          <Link
            key={chip.label}
            href={chip.href}
            className="text-white no-underline"
            style={{
              background: "rgba(255,255,255,0.22)",
              border: "1px solid rgba(255,255,255,0.35)",
              padding: "6px 13px",
              borderRadius: 9999,
              fontSize: 12,
              fontFamily: "var(--font-sora), sans-serif",
            }}
          >
            {chip.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
