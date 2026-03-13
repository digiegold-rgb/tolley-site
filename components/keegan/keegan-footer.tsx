"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HUB_NAV } from "@/lib/keegan";

export function KeeganFooter() {
  const pathname = usePathname();

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/90 backdrop-blur-md">
      <nav className="mx-auto flex max-w-lg items-center justify-center gap-1 px-4 py-2">
        {HUB_NAV.map(({ label, href }) => {
          const active = href === "/keegan" ? pathname === "/keegan" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
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
