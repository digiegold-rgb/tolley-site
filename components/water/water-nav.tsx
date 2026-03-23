"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WATER_TABS } from "@/lib/water";

export function WaterNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-1">
      {WATER_TABS.map((tab) => {
        const isActive =
          tab.href === "/water"
            ? pathname === "/water"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`water-tab ${isActive ? "water-tab-active" : ""}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
