"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import type {
  CrmLead,
  CrmTask,
  CrmTag,
  CrmDeal,
  SmartListDef,
} from "@/lib/crm-types";
import { PIPELINE_STAGES } from "@/lib/crm-types";
import KanbanColumn from "./KanbanColumn";
import LeadCard from "./LeadCard";
import CardDetailDrawer from "./CardDetailDrawer";
import TaskPanel from "./TaskPanel";
import SmartListSidebar from "./SmartListSidebar";
import DealTracker from "./DealTracker";

interface CrmBoardProps {
  initialLeads: Record<string, CrmLead[]>;
  initialTasks: CrmTask[];
  initialTags: CrmTag[];
  initialDeals: CrmDeal[];
  initialSmartLists: SmartListDef[];
}

type ViewMode = "kanban" | "deals";

function formatPipelineValue(leads: CrmLead[]): string {
  const total = leads.reduce(
    (sum, l) => sum + (l.listing?.listPrice ?? 0),
    0
  );
  if (total === 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(total);
}

export default function CrmBoard({
  initialLeads,
  initialTasks,
  initialTags,
  initialDeals,
  initialSmartLists,
}: CrmBoardProps) {
  // Core state
  const [leadsByStage, setLeadsByStage] =
    useState<Record<string, CrmLead[]>>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [activeDragLead, setActiveDragLead] = useState<CrmLead | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [showFilters, setShowFilters] = useState(false);

  // Smart lists
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [smartListResults, setSmartListResults] = useState<CrmLead[] | null>(
    null
  );

  // DnD sensors with activation distance to prevent accidental drags
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const sensors = useSensors(pointerSensor);

  // All leads flat
  const allLeads = useMemo(() => {
    const all: CrmLead[] = [];
    for (const stage of Object.values(leadsByStage)) {
      all.push(...stage);
    }
    return all;
  }, [leadsByStage]);

  // Filtered leads per stage
  const filteredLeadsByStage = useMemo(() => {
    const result: Record<string, CrmLead[]> = {};
    for (const stage of PIPELINE_STAGES) {
      const stageLeads = leadsByStage[stage.id] || [];
      result[stage.id] = stageLeads.filter((lead) => {
        // Search filter
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchName = lead.ownerName?.toLowerCase().includes(q);
          const matchAddr = lead.listing?.address?.toLowerCase().includes(q);
          const matchCity = lead.listing?.city?.toLowerCase().includes(q);
          const matchEmail = lead.ownerEmail?.toLowerCase().includes(q);
          const matchPhone = lead.ownerPhone?.includes(q);
          if (
            !matchName &&
            !matchAddr &&
            !matchCity &&
            !matchEmail &&
            !matchPhone
          )
            return false;
        }
        // Source filter
        if (sourceFilter !== "all" && lead.source !== sourceFilter) {
          return false;
        }
        // Score range
        if (lead.score < scoreMin || lead.score > scoreMax) {
          return false;
        }
        return true;
      });
    }
    return result;
  }, [leadsByStage, searchQuery, sourceFilter, scoreMin, scoreMax]);

  // Stats
  const stats = useMemo(() => {
    const totalLeads = allLeads.length;
    const pipelineLeads = allLeads.filter(
      (l) =>
        l.status === "referred" ||
        l.status === "closed"
    );
    const pipelineValue = formatPipelineValue(pipelineLeads);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const tasksDueToday = initialTasks.filter((t) => {
      if (t.status !== "pending" || !t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= todayStart && d <= todayEnd;
    }).length;

    return { totalLeads, pipelineValue, tasksDueToday };
  }, [allLeads, initialTasks]);

  // Available sources for filter dropdown
  const availableSources = useMemo(() => {
    const s = new Set<string>();
    for (const lead of allLeads) {
      if (lead.source) s.add(lead.source);
    }
    return Array.from(s).sort();
  }, [allLeads]);

  // Find which stage a lead is in
  const findLeadStage = useCallback(
    (leadId: string): string | null => {
      for (const [stage, leads] of Object.entries(leadsByStage)) {
        if (leads.some((l) => l.id === leadId)) return stage;
      }
      return null;
    },
    [leadsByStage]
  );

  // DnD handlers
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const leadId = active.id as string;
      // Find the lead
      for (const leads of Object.values(leadsByStage)) {
        const found = leads.find((l) => l.id === leadId);
        if (found) {
          setActiveDragLead(found);
          break;
        }
      }
    },
    [leadsByStage]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDragLead(null);

      const { active, over } = event;
      if (!over) return;

      const leadId = active.id as string;
      const overId = over.id as string;

      // Determine the target stage
      // If dropped over a column (stage id), use that
      // If dropped over another card, find that card's stage
      let targetStage: string | null = null;

      // Check if overId is a stage
      if (PIPELINE_STAGES.some((s) => s.id === overId)) {
        targetStage = overId;
      } else {
        // It's a card id -- find its stage
        targetStage = findLeadStage(overId);
      }

      if (!targetStage) return;

      const currentStage = findLeadStage(leadId);
      if (!currentStage || currentStage === targetStage) return;

      // Optimistic update
      setLeadsByStage((prev) => {
        const next = { ...prev };
        const lead = next[currentStage]?.find((l) => l.id === leadId);
        if (!lead) return prev;

        next[currentStage] = next[currentStage].filter(
          (l) => l.id !== leadId
        );
        const updatedLead = { ...lead, status: targetStage };
        next[targetStage] = [...(next[targetStage] || []), updatedLead];
        return next;
      });

      // API call
      try {
        const res = await fetch("/api/leads/crm/pipeline", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId,
            newStage: targetStage,
          }),
        });

        if (!res.ok) {
          // Revert on error
          console.error("Pipeline update failed, reverting");
          setLeadsByStage((prev) => {
            const next = { ...prev };
            const lead = next[targetStage]?.find((l) => l.id === leadId);
            if (!lead) return prev;

            next[targetStage] = next[targetStage].filter(
              (l) => l.id !== leadId
            );
            next[currentStage] = [
              ...(next[currentStage] || []),
              { ...lead, status: currentStage },
            ];
            return next;
          });
        } else {
          // Update with server response
          const updated: CrmLead = await res.json();
          setLeadsByStage((prev) => {
            const next = { ...prev };
            next[targetStage] = next[targetStage].map((l) =>
              l.id === leadId ? updated : l
            );
            return next;
          });
        }
      } catch (err) {
        console.error("Pipeline update error:", err);
        // Revert
        setLeadsByStage((prev) => {
          const next = { ...prev };
          const lead = next[targetStage]?.find((l) => l.id === leadId);
          if (!lead) return prev;

          next[targetStage] = next[targetStage].filter(
            (l) => l.id !== leadId
          );
          next[currentStage] = [
            ...(next[currentStage] || []),
            { ...lead, status: currentStage },
          ];
          return next;
        });
      }
    },
    [findLeadStage]
  );

  // Stage change from drawer
  const handleStageChange = useCallback(
    async (leadId: string, newStage: string) => {
      const currentStage = findLeadStage(leadId);
      if (!currentStage || currentStage === newStage) return;

      // Optimistic update
      setLeadsByStage((prev) => {
        const next = { ...prev };
        const lead = next[currentStage]?.find((l) => l.id === leadId);
        if (!lead) return prev;

        next[currentStage] = next[currentStage].filter(
          (l) => l.id !== leadId
        );
        const updatedLead = { ...lead, status: newStage };
        next[newStage] = [...(next[newStage] || []), updatedLead];

        // Update selected lead if it's the same one
        if (selectedLead?.id === leadId) {
          setSelectedLead(updatedLead);
        }
        return next;
      });

      try {
        const res = await fetch("/api/leads/crm/pipeline", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, newStage }),
        });
        if (res.ok) {
          const updated: CrmLead = await res.json();
          setLeadsByStage((prev) => {
            const next = { ...prev };
            next[newStage] = next[newStage].map((l) =>
              l.id === leadId ? updated : l
            );
            return next;
          });
          if (selectedLead?.id === leadId) {
            setSelectedLead(updated);
          }
        }
      } catch (err) {
        console.error("Stage change error:", err);
      }
    },
    [findLeadStage, selectedLead]
  );

  // Smart list selection
  const handleSelectList = useCallback(
    async (listId: string | null) => {
      setActiveListId(listId);
      if (!listId) {
        setSmartListResults(null);
        return;
      }
      try {
        const res = await fetch(
          `/api/leads/crm/smart-lists/${listId}/results`
        );
        if (res.ok) {
          const data = await res.json();
          setSmartListResults(data.leads || data || []);
        }
      } catch (err) {
        console.error("Smart list fetch error:", err);
        setSmartListResults(null);
      }
    },
    []
  );

  // When a smart list is active, override leads display
  const displayLeadsByStage = useMemo(() => {
    if (!smartListResults) return filteredLeadsByStage;
    // Group smart list results by stage
    const grouped: Record<string, CrmLead[]> = {};
    for (const stage of PIPELINE_STAGES) {
      grouped[stage.id] = [];
    }
    for (const lead of smartListResults) {
      const stage = lead.status || "new_lead";
      if (grouped[stage]) {
        grouped[stage].push(lead);
      }
    }
    return grouped;
  }, [filteredLeadsByStage, smartListResults]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-white/10 bg-[#06050a]">
        <div className="flex items-center gap-3 p-3">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads..."
              className="w-full text-xs bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 text-xs">
              ?
            </span>
          </div>

          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
              showFilters
                ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                : "border-white/10 text-white/40 hover:text-white/60 hover:bg-white/5"
            }`}
          >
            Filters
            {(sourceFilter !== "all" || scoreMin > 0 || scoreMax < 100) && (
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
            )}
          </button>

          {/* View toggle */}
          <div className="flex items-center bg-white/5 rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => setViewMode("kanban")}
              className={`text-xs px-3 py-2 transition-colors ${
                viewMode === "kanban"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode("deals")}
              className={`text-xs px-3 py-2 transition-colors ${
                viewMode === "deals"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Deals
            </button>
          </div>
        </div>

        {/* Filter row */}
        {showFilters && (
          <div className="flex items-center gap-3 px-3 pb-3 border-t border-white/5 pt-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-white/40 uppercase tracking-wider">
                Source
              </label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none [color-scheme:dark]"
              >
                <option value="all">All</option>
                {availableSources.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[10px] text-white/40 uppercase tracking-wider">
                Score
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={scoreMin}
                onChange={(e) => setScoreMin(parseInt(e.target.value) || 0)}
                className="w-14 text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-white/30 text-xs">-</span>
              <input
                type="number"
                min={0}
                max={100}
                value={scoreMax}
                onChange={(e) =>
                  setScoreMax(parseInt(e.target.value) || 100)
                }
                className="w-14 text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {(sourceFilter !== "all" || scoreMin > 0 || scoreMax < 100) && (
              <button
                onClick={() => {
                  setSourceFilter("all");
                  setScoreMin(0);
                  setScoreMax(100);
                }}
                className="text-[10px] text-red-300 hover:text-red-200 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Stats bar */}
        <div className="flex items-center gap-6 px-3 pb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              Leads
            </span>
            <span className="text-xs font-bold text-white">
              {stats.totalLeads}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              Pipeline
            </span>
            <span className="text-xs font-bold text-emerald-300">
              {stats.pipelineValue}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              Tasks Due
            </span>
            <span
              className={`text-xs font-bold ${
                stats.tasksDueToday > 0 ? "text-yellow-300" : "text-white/50"
              }`}
            >
              {stats.tasksDueToday}
            </span>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Smart list sidebar */}
        {viewMode === "kanban" && (
          <SmartListSidebar
            smartLists={initialSmartLists}
            activeListId={activeListId}
            onSelectList={handleSelectList}
          />
        )}

        {/* Board / Deals */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {viewMode === "kanban" && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-3 p-3 overflow-x-auto h-full">
                {PIPELINE_STAGES.map((stage) => (
                  <KanbanColumn
                    key={stage.id}
                    stage={stage}
                    leads={displayLeadsByStage[stage.id] || []}
                    onCardClick={setSelectedLead}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeDragLead ? (
                  <div className="w-[264px] opacity-90">
                    <LeadCard
                      lead={activeDragLead}
                      onClick={() => {}}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {viewMode === "deals" && (
            <div className="p-4 overflow-y-auto h-full">
              <DealTracker initialDeals={initialDeals} />
            </div>
          )}
        </div>

        {/* Task panel */}
        {viewMode === "kanban" && (
          <TaskPanel initialTasks={initialTasks} />
        )}
      </div>

      {/* Card detail drawer */}
      {selectedLead && (
        <CardDetailDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStageChange={handleStageChange}
          tags={initialTags}
        />
      )}
    </div>
  );
}
