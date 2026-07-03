"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TabKey = "all" | "sold" | "videos" | "reviews";

interface TabDef {
  key: TabKey;
  label: string;
  href: string;
}

const TABS: ReadonlyArray<TabDef> = [
  { key: "all", label: "Browse", href: "/shop" },
  { key: "sold", label: "Sold", href: "/shop/sold" },
  { key: "videos", label: "Videos", href: "/shop/videos" },
  { key: "reviews", label: "Reviews", href: "/shop/reviews" },
];

export interface ShopTabsProps {
  position: "top" | "bottom";
  counts?: Partial<Record<TabKey, number>>;
}

export default function ShopTabs({ position, counts }: ShopTabsProps) {
  const pathname = usePathname();

  const positionClass =
    position === "top"
      ? "shop-tabs is-sticky"
      : "shop-tabs";

  return (
    <nav
      aria-label={position === "top" ? "Shop sections" : "Shop sections (bottom)"}
      className={`${positionClass} -webkit-overflow-scrolling-touch overflow-x-auto`}
    >
      <ul className="mx-auto flex max-w-5xl items-center gap-1.5 px-4 py-2">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          const count = counts?.[tab.key];
          return (
            <li key={tab.key} className="flex-shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`shop-tab ${active ? "is-active" : ""} inline-flex items-center gap-1.5 text-xs font-medium`}
              >
                <span>{tab.label}</span>
                {typeof count === "number" && (
                  <span
                    className={`shop-tab-count rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold ${
                      active
                        ? "bg-purple-500/30 text-purple-100"
                        : "bg-white/10 text-white/55"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
