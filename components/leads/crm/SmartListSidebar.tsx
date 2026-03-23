"use client";

import { useState, useCallback } from "react";
import type { SmartListDef } from "@/lib/crm-types";
import { PIPELINE_STAGES } from "@/lib/crm-types";

interface SmartListSidebarProps {
  smartLists: SmartListDef[];
  activeListId: string | null;
  onSelectList: (id: string | null) => void;
}

const DEFAULT_ICONS: Record<string, string> = {
  star: "★",
  fire: "🔥",
  clock: "⏱",
  target: "◎",
  dollar: "$",
  phone: "☎",
  home: "⌂",
  tag: "#",
};

interface CreateFormData {
  name: string;
  stages: string[];
  sources: string[];
  scoreMin: number;
  scoreMax: number;
  lastContactDays: number | null;
}

export default function SmartListSidebar({
  smartLists,
  activeListId,
  onSelectList,
}: SmartListSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [lists, setLists] = useState<SmartListDef[]>(smartLists);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateFormData>({
    name: "",
    stages: [],
    sources: [],
    scoreMin: 0,
    scoreMax: 100,
    lastContactDays: null,
  });

  const pinnedLists = lists.filter((l) => l.isPinned);
  const unpinnedLists = lists.filter((l) => !l.isPinned);

  const KNOWN_SOURCES = [
    "mls_grid",
    "zillow",
    "manual",
    "referral",
    "website",
    "sms",
    "import",
  ];

  const toggleStage = useCallback(
    (stageId: string) => {
      setForm((prev) => ({
        ...prev,
        stages: prev.stages.includes(stageId)
          ? prev.stages.filter((s) => s !== stageId)
          : [...prev.stages, stageId],
      }));
    },
    []
  );

  const toggleSource = useCallback(
    (source: string) => {
      setForm((prev) => ({
        ...prev,
        sources: prev.sources.includes(source)
          ? prev.sources.filter((s) => s !== source)
          : [...prev.sources, source],
      }));
    },
    []
  );

  const createList = useCallback(async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const filters: Record<string, unknown> = {};
      if (form.stages.length > 0) filters.stages = form.stages;
      if (form.sources.length > 0) filters.sources = form.sources;
      if (form.scoreMin > 0 || form.scoreMax < 100) {
        filters.scoreRange = { min: form.scoreMin, max: form.scoreMax };
      }
      if (form.lastContactDays != null && form.lastContactDays > 0) {
        filters.lastContactDays = form.lastContactDays;
      }

      const res = await fetch("/api/leads/crm/smart-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          filters,
          sortBy: "score",
          sortDir: "desc",
        }),
      });

      if (res.ok) {
        const created: SmartListDef = await res.json();
        setLists((prev) => [...prev, created]);
        setForm({
          name: "",
          stages: [],
          sources: [],
          scoreMin: 0,
          scoreMax: 100,
          lastContactDays: null,
        });
        setShowCreate(false);
      }
    } catch (err) {
      console.error("Create smart list error:", err);
    } finally {
      setSaving(false);
    }
  }, [form]);

  if (collapsed) {
    return (
      <div className="w-10 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
          title="Show smart lists"
        >
          <span className="text-xs font-bold">L</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-56 shrink-0 border-r border-white/10 bg-[#0a0914] flex flex-col max-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">Lists</h3>
        <button
          onClick={() => setCollapsed(true)}
          className="text-white/30 hover:text-white/60 text-xs transition-colors"
        >
          x
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* All Leads */}
        <button
          onClick={() => onSelectList(null)}
          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors mb-1 ${
            activeListId === null
              ? "bg-white/10 text-white font-medium"
              : "text-white/60 hover:bg-white/5 hover:text-white/80"
          }`}
        >
          <span className="mr-2">◉</span>
          All Leads
        </button>

        {/* Pinned */}
        {pinnedLists.length > 0 && (
          <div className="mt-3 mb-2">
            <p className="text-[10px] text-white/30 uppercase tracking-wider px-3 mb-1">
              Pinned
            </p>
            {pinnedLists.map((list) => (
              <button
                key={list.id}
                onClick={() => onSelectList(list.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors mb-0.5 ${
                  activeListId === list.id
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/60 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <span className="mr-2">
                  {list.icon ? DEFAULT_ICONS[list.icon] || list.icon : "★"}
                </span>
                {list.name}
              </button>
            ))}
          </div>
        )}

        {/* All lists */}
        {unpinnedLists.length > 0 && (
          <div className="mt-3 mb-2">
            <p className="text-[10px] text-white/30 uppercase tracking-wider px-3 mb-1">
              Smart Lists
            </p>
            {unpinnedLists.map((list) => (
              <button
                key={list.id}
                onClick={() => onSelectList(list.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors mb-0.5 ${
                  activeListId === list.id
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/60 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <span className="mr-2">
                  {list.icon ? DEFAULT_ICONS[list.icon] || list.icon : "◇"}
                </span>
                {list.name}
              </button>
            ))}
          </div>
        )}

        {/* Create button */}
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="w-full text-left px-3 py-2 mt-2 rounded-lg text-xs text-blue-400 hover:bg-blue-500/10 transition-colors"
        >
          + Create Smart List
        </button>

        {/* Create form */}
        {showCreate && (
          <div className="mt-2 p-3 bg-white/5 rounded-lg border border-white/10 space-y-3">
            {/* Name */}
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="List name..."
              className="w-full text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white placeholder-white/30 focus:outline-none focus:border-white/20"
            />

            {/* Stages */}
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                Stages
              </p>
              <div className="flex flex-wrap gap-1">
                {PIPELINE_STAGES.map((stage) => (
                  <button
                    key={stage.id}
                    onClick={() => toggleStage(stage.id)}
                    className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                      form.stages.includes(stage.id)
                        ? "bg-white/20 text-white"
                        : "bg-white/5 text-white/40 hover:text-white/60"
                    }`}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sources */}
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                Sources
              </p>
              <div className="flex flex-wrap gap-1">
                {KNOWN_SOURCES.map((src) => (
                  <button
                    key={src}
                    onClick={() => toggleSource(src)}
                    className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                      form.sources.includes(src)
                        ? "bg-white/20 text-white"
                        : "bg-white/5 text-white/40 hover:text-white/60"
                    }`}
                  >
                    {src}
                  </button>
                ))}
              </div>
            </div>

            {/* Score range */}
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                Score Range
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.scoreMin}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      scoreMin: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-16 text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-white/30 text-xs">to</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.scoreMax}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      scoreMax: parseInt(e.target.value) || 100,
                    }))
                  }
                  className="w-16 text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            {/* Last contact */}
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                Last Contact (days ago)
              </p>
              <input
                type="number"
                min={0}
                value={form.lastContactDays ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    lastContactDays: e.target.value
                      ? parseInt(e.target.value)
                      : null,
                  }))
                }
                placeholder="e.g. 7"
                className="w-full text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white placeholder-white/30 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Save */}
            <button
              onClick={createList}
              disabled={!form.name.trim() || saving}
              className="w-full text-xs bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-lg py-2 transition-colors disabled:opacity-30"
            >
              {saving ? "Saving..." : "Create List"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
