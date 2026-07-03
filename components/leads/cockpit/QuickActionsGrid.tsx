"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface QuickAction {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  accent?: "purple" | "emerald" | "blue" | "yellow";
}

const ACTIONS: QuickAction[] = [
  {
    id: "snap",
    label: "Snap & Know",
    href: "/leads/snap",
    accent: "purple",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        width="18"
        height="18"
      >
        <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    id: "dossier",
    label: "Dossier",
    href: "/leads/dossier",
    accent: "blue",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        width="18"
        height="18"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </svg>
    ),
  },
  {
    id: "cma",
    label: "CMA / Comps",
    href: "/leads/comps",
    accent: "emerald",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        width="18"
        height="18"
      >
        <path d="M3 3v18h18" />
        <path d="M7 16l4-4 4 4 5-7" />
      </svg>
    ),
  },
  {
    id: "unclaimed",
    label: "Unclaimed $",
    href: "/leads/unclaimed",
    accent: "emerald",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        width="18"
        height="18"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10" />
        <path d="M15 10c-.8-1-2-1.5-3-1.5-1.5 0-3 .8-3 2s1.5 1.8 3 2.2 3 1 3 2.3-1.5 2-3 2c-1.3 0-2.5-.5-3-1.5" />
      </svg>
    ),
  },
  {
    id: "sequences",
    label: "Sequences",
    href: "/leads/sequences",
    accent: "yellow",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        width="18"
        height="18"
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
      </svg>
    ),
  },
  {
    id: "markets",
    label: "Market intel",
    href: "/leads/markets",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        width="18"
        height="18"
      >
        <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z" />
        <path d="M3 12h18" />
        <path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>
    ),
  },
];

export default function QuickActionsGrid() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-lg shadow-violet-500/5 backdrop-blur-sm">
      <h2 className="mb-3 text-sm font-semibold text-white">Quick actions</h2>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((action) => (
          <ActionButton key={action.id} action={action} />
        ))}
      </div>
    </div>
  );
}

function ActionButton({ action }: { action: QuickAction }) {
  const accentClass = {
    purple:
      "border-violet-400/25 bg-gradient-to-br from-violet-400/10 to-fuchsia-400/5 text-violet-100 hover:border-violet-300/50 hover:from-violet-400/20 hover:to-fuchsia-400/10 hover:-translate-y-0.5",
    emerald:
      "border-emerald-400/25 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 text-emerald-100 hover:border-emerald-300/50 hover:from-emerald-400/20 hover:to-teal-400/10 hover:-translate-y-0.5",
    blue:
      "border-sky-400/25 bg-gradient-to-br from-sky-400/10 to-cyan-400/5 text-sky-100 hover:border-sky-300/50 hover:from-sky-400/20 hover:to-cyan-400/10 hover:-translate-y-0.5",
    yellow:
      "border-amber-400/25 bg-gradient-to-br from-amber-400/10 to-orange-400/5 text-amber-100 hover:border-amber-300/50 hover:from-amber-400/20 hover:to-orange-400/10 hover:-translate-y-0.5",
  }[action.accent ?? "blue"];

  const className = `flex flex-col items-start gap-2 rounded-xl border p-3 text-left text-sm font-medium transition-all duration-200 ${accentClass}`;

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.icon}
        <span>{action.label}</span>
      </Link>
    );
  }
  return (
    <button onClick={action.onClick} className={className}>
      {action.icon}
      <span>{action.label}</span>
    </button>
  );
}
