"use client";

import { PLATFORMS } from "@/lib/shop/types";

export function PlatformBadge({ platform, size = "sm" }: { platform: string; size?: "sm" | "md" }) {
  const p = PLATFORMS.find((pl) => pl.value === platform);
  const label = p?.label || platform;
  const color = p?.color || "#6B7280";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${
        size === "sm" ? "px-2 py-0.5 text-[0.65rem]" : "px-2.5 py-1 text-xs"
      }`}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    draft: { bg: "rgba(107,114,128,0.15)", text: "#9CA3AF" },
    listed: { bg: "rgba(59,130,246,0.15)", text: "#60A5FA" },
    active: { bg: "rgba(34,197,94,0.15)", text: "#4ADE80" },
    sold: { bg: "rgba(34,197,94,0.2)", text: "#22C55E" },
    pending: { bg: "rgba(234,179,8,0.15)", text: "#FACC15" },
    archived: { bg: "rgba(156,163,175,0.15)", text: "#9CA3AF" },
    returned: { bg: "rgba(239,68,68,0.15)", text: "#F87171" },
    removed: { bg: "rgba(239,68,68,0.1)", text: "#EF4444" },
    expired: { bg: "rgba(107,114,128,0.1)", text: "#6B7280" },
  };

  const c = colors[status] || colors.draft;

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-medium capitalize"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {status}
    </span>
  );
}
