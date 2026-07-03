"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Vertical navigation rail. Used as the T-Agent left sidebar. Active item is
 * highlighted automatically based on pathname matching. Collapses to an
 * icon-only rail at narrow widths via the `collapsed` prop.
 */

export interface SidebarItem {
  href: string;
  label: string;
  icon?: ReactNode;
  match?: RegExp;
  accent?: "purple" | "emerald" | "blue";
  badge?: ReactNode;
  shortcut?: string;
}

export function Sidebar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={`flex h-full w-60 flex-col border-r border-white/10 bg-[#06050a] ${className}`}
    >
      {children}
    </aside>
  );
}

export function SidebarBrand({
  children,
  href = "/leads",
}: {
  children: ReactNode;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-14 items-center border-b border-white/10 px-5 text-sm font-semibold tracking-tight text-white/80 hover:text-white"
    >
      {children}
    </Link>
  );
}

export function SidebarSection({
  label,
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-2 py-3 ${className}`}>
      {label && (
        <div className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-white/30">
          {label}
        </div>
      )}
      <nav className="space-y-0.5">{children}</nav>
    </div>
  );
}

export function SidebarLink({
  item,
  compact = false,
}: {
  item: SidebarItem;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const match = item.match ?? new RegExp(`^${escapeRegex(item.href)}(/|$)`);
  const active = pathname ? match.test(pathname) : false;

  const accentActive = {
    purple: "bg-purple-500/10 text-purple-300",
    emerald: "bg-emerald-500/10 text-emerald-300",
    blue: "bg-blue-500/10 text-blue-300",
  };
  const accentInactive = {
    purple: "text-purple-300/60 hover:bg-purple-500/5 hover:text-purple-200",
    emerald: "text-emerald-300/60 hover:bg-emerald-500/5 hover:text-emerald-200",
    blue: "text-blue-300/60 hover:bg-blue-500/5 hover:text-blue-200",
  };

  let cls: string;
  if (active) {
    cls = item.accent
      ? accentActive[item.accent]
      : "bg-white/10 text-white";
  } else {
    cls = item.accent
      ? accentInactive[item.accent]
      : "text-white/50 hover:bg-white/5 hover:text-white/80";
  }

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${cls} ${
        compact ? "py-1" : ""
      }`}
    >
      {item.icon && (
        <span className="flex h-5 w-5 items-center justify-center text-inherit">
          {item.icon}
        </span>
      )}
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge}
      {item.shortcut && (
        <span className="text-[10px] text-white/20">{item.shortcut}</span>
      )}
    </Link>
  );
}

export function SidebarFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mt-auto border-t border-white/10 px-4 py-3 ${className}`}
    >
      {children}
    </div>
  );
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default Sidebar;
