"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CrmLead } from "@/lib/crm-types";

interface LeadCardProps {
  lead: CrmLead;
  onClick: () => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatPrice(price: number | null | undefined): string {
  if (price == null) return "";
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `$${Math.round(price / 1_000)}k`;
  return `$${price}`;
}

function scoreColor(score: number): string {
  if (score >= 61) return "bg-emerald-500/20 text-emerald-300";
  if (score >= 31) return "bg-yellow-500/20 text-yellow-300";
  return "bg-red-500/20 text-red-300";
}

export default function LeadCard({ lead, onClick }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Don't trigger click if this was a drag
        if (!isDragging) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={`
        group cursor-grab active:cursor-grabbing
        rounded-lg border border-white/10 bg-white/5 p-3
        hover:bg-white/10 hover:scale-[1.01] transition-all duration-150
        ${isDragging ? "ring-2 ring-blue-500/50 shadow-xl shadow-blue-500/10" : ""}
      `}
    >
      {/* Top row: name + score */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h4 className="text-sm font-semibold text-white truncate flex-1">
          {lead.ownerName || "Unknown Owner"}
        </h4>
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${scoreColor(lead.score)}`}
        >
          {lead.score}
        </span>
      </div>

      {/* Address */}
      {lead.listing && (
        <p className="text-xs text-white/50 truncate mb-1.5">
          {lead.listing.address}
          {lead.listing.city ? `, ${lead.listing.city}` : ""}
        </p>
      )}

      {/* Price + source row */}
      <div className="flex items-center gap-2 mb-2">
        {lead.listing?.listPrice != null && (
          <span className="text-xs font-medium text-white/70">
            {formatPrice(lead.listing.listPrice)}
          </span>
        )}
        {lead.source && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">
            {lead.source}
          </span>
        )}
      </div>

      {/* Referral info */}
      {lead.referredTo && (
        <div className="flex items-center gap-1 mb-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
            Referred: {lead.referredTo}
          </span>
        </div>
      )}

      {/* Bottom row: last activity */}
      <div className="flex items-center justify-between text-[10px] text-white/40">
        <span>{timeAgo(lead.updatedAt)}</span>
        {lead.referralFee != null && lead.referralFee > 0 && (
          <span className="text-emerald-300 font-medium">
            ${lead.referralFee.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
