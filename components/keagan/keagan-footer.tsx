"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HUB_NAV } from "@/lib/keagan";

export function KeeganFooter() {
  const pathname = usePathname();

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-gray-200/50">
      <nav className="mx-auto flex max-w-lg items-center justify-center gap-2 px-4 py-2.5">
        {HUB_NAV.map(({ label, href }) => {
          const active = href === "/keagan" ? pathname === "/keagan" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                active
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </footer>
  );
}
