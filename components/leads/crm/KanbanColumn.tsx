"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { CrmLead } from "@/lib/crm-types";
import { PIPELINE_STAGES } from "@/lib/crm-types";
import LeadCard from "./LeadCard";

type StageInfo = (typeof PIPELINE_STAGES)[number];

interface KanbanColumnProps {
  stage: StageInfo;
  leads: CrmLead[];
  onCardClick: (lead: CrmLead) => void;
}

const STAGE_COLORS: Record<string, { badge: string; header: string }> = {
  blue: {
    badge: "bg-blue-500/20 text-blue-300",
    header: "border-blue-500/30",
  },
  yellow: {
    badge: "bg-yellow-500/20 text-yellow-300",
    header: "border-yellow-500/30",
  },
  orange: {
    badge: "bg-orange-500/20 text-orange-300",
    header: "border-orange-500/30",
  },
  purple: {
    badge: "bg-purple-500/20 text-purple-300",
    header: "border-purple-500/30",
  },
  indigo: {
    badge: "bg-indigo-500/20 text-indigo-300",
    header: "border-indigo-500/30",
  },
  emerald: {
    badge: "bg-emerald-500/20 text-emerald-300",
    header: "border-emerald-500/30",
  },
  red: {
    badge: "bg-red-500/20 text-red-300",
    header: "border-red-500/30",
  },
};

function formatPipelineValue(leads: CrmLead[]): string {
  const total = leads.reduce(
    (sum, l) => sum + (l.listing?.listPrice ?? 0),
    0
  );
  if (total === 0) return "";
  if (total >= 1_000_000) return `$${(total / 1_000_000).toFixed(1)}M`;
  if (total >= 1_000) return `$${Math.round(total / 1_000)}k`;
  return `$${total}`;
}

export default function KanbanColumn({
  stage,
  leads,
  onCardClick,
}: KanbanColumnProps) {
  const isCollapsible = stage.id === "closed" || stage.id === "dead";
  const [collapsed, setCollapsed] = useState(isCollapsible);

  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const colors = STAGE_COLORS[stage.color] || STAGE_COLORS.blue;
  const pipelineValue = formatPipelineValue(leads);
  const sortableIds = leads.map((l) => l.id);

  return (
    <div
      className={`
        flex flex-col min-w-[280px] w-[280px] shrink-0
        rounded-xl border border-white/10 bg-[#0a0914]
        transition-all duration-200
        ${isOver ? "ring-2 ring-blue-500/30 bg-blue-500/5" : ""}
        ${collapsed ? "w-[60px] min-w-[60px]" : ""}
      `}
    >
      {/* Column header */}
      <div
        className={`
          flex items-center gap-2 p-3 border-b border-white/10
          ${isCollapsible ? "cursor-pointer" : ""}
        `}
        onClick={isCollapsible ? () => setCollapsed(!collapsed) : undefined}
      >
        {isCollapsible && (
          <button className="text-white/40 hover:text-white/70 text-xs shrink-0">
            {collapsed ? "+" : "-"}
          </button>
        )}

        {collapsed ? (
          <div className="flex flex-col items-center gap-1 w-full">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge} whitespace-nowrap`}
              style={{
                writingMode: "vertical-lr",
                textOrientation: "mixed",
              }}
            >
              {stage.label}
            </span>
            <span className="text-[10px] text-white/40 font-medium">
              {leads.length}
            </span>
          </div>
        ) : (
          <>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.badge}`}
            >
              {stage.label}
            </span>
            <span className="text-[10px] text-white/40 font-medium">
              {leads.length}
            </span>
            {pipelineValue && (
              <span className="text-[10px] text-white/30 ml-auto font-medium">
                {pipelineValue}
              </span>
            )}
          </>
        )}
      </div>

      {/* Cards area */}
      {!collapsed && (
        <div
          ref={setNodeRef}
          className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-240px)] scrollbar-thin"
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            {leads.length === 0 ? (
              <div className="text-center text-white/20 text-xs py-8">
                No leads
              </div>
            ) : (
              leads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onClick={() => onCardClick(lead)}
                />
              ))
            )}
          </SortableContext>
        </div>
      )}
    </div>
  );
}
