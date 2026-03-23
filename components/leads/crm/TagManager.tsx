"use client";

import { useState, useRef, useEffect } from "react";
import type { CrmTag } from "@/lib/crm-types";

interface TagManagerProps {
  currentTags: Array<{ id: string; tag: CrmTag }>;
  allTags: CrmTag[];
  leadId?: string;
  clientId?: string;
  onTagChange: () => void;
}

const PRESET_COLORS = [
  { name: "blue", bg: "bg-blue-500", preview: "bg-blue-500/20 text-blue-300" },
  {
    name: "green",
    bg: "bg-emerald-500",
    preview: "bg-emerald-500/20 text-emerald-300",
  },
  { name: "red", bg: "bg-red-500", preview: "bg-red-500/20 text-red-300" },
  {
    name: "yellow",
    bg: "bg-yellow-500",
    preview: "bg-yellow-500/20 text-yellow-300",
  },
  {
    name: "purple",
    bg: "bg-purple-500",
    preview: "bg-purple-500/20 text-purple-300",
  },
  {
    name: "orange",
    bg: "bg-orange-500",
    preview: "bg-orange-500/20 text-orange-300",
  },
];

const TAG_BADGE_COLORS: Record<string, string> = {
  blue: "bg-blue-500/20 text-blue-300",
  green: "bg-emerald-500/20 text-emerald-300",
  red: "bg-red-500/20 text-red-300",
  yellow: "bg-yellow-500/20 text-yellow-300",
  purple: "bg-purple-500/20 text-purple-300",
  orange: "bg-orange-500/20 text-orange-300",
  pink: "bg-pink-500/20 text-pink-300",
  indigo: "bg-indigo-500/20 text-indigo-300",
};

export default function TagManager({
  currentTags,
  allTags,
  leadId,
  clientId,
  onTagChange,
}: TagManagerProps) {
  const [inputValue, setInputValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTagColor, setNewTagColor] = useState("blue");
  const [removing, setRemoving] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTagIds = new Set(currentTags.map((ct) => ct.tag.id));
  const availableTags = allTags.filter(
    (t) =>
      !currentTagIds.has(t.id) &&
      t.name.toLowerCase().includes(inputValue.toLowerCase())
  );
  const hasExactMatch = allTags.some(
    (t) => t.name.toLowerCase() === inputValue.toLowerCase()
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
        setShowCreateForm(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function assignTag(tagId: string) {
    try {
      const res = await fetch("/api/leads/crm/tags/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId, leadId, clientId }),
      });
      if (res.ok) {
        setInputValue("");
        setShowDropdown(false);
        onTagChange();
      }
    } catch (err) {
      console.error("Tag assign error:", err);
    }
  }

  async function removeTag(assignmentId: string) {
    try {
      setRemoving(assignmentId);
      const res = await fetch("/api/leads/crm/tags/assign", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, leadId, clientId }),
      });
      if (res.ok) {
        onTagChange();
      }
    } catch (err) {
      console.error("Tag remove error:", err);
    } finally {
      setRemoving(null);
    }
  }

  async function createAndAssign() {
    if (!inputValue.trim()) return;
    try {
      const res = await fetch("/api/leads/crm/tags/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createTag: { name: inputValue.trim(), color: newTagColor },
          leadId,
          clientId,
        }),
      });
      if (res.ok) {
        setInputValue("");
        setShowCreateForm(false);
        setShowDropdown(false);
        onTagChange();
      }
    } catch (err) {
      console.error("Tag create error:", err);
    }
  }

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Current tags */}
      <div className="flex flex-wrap gap-1.5">
        {currentTags.map((ct) => (
          <span
            key={ct.id}
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${TAG_BADGE_COLORS[ct.tag.color] || "bg-white/10 text-white/60"}`}
          >
            {ct.tag.name}
            <button
              onClick={() => removeTag(ct.id)}
              disabled={removing === ct.id}
              className="hover:text-white transition-colors text-current opacity-60 hover:opacity-100 ml-0.5"
            >
              x
            </button>
          </span>
        ))}
      </div>

      {/* Input */}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowDropdown(true);
            setShowCreateForm(false);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Add tag..."
          className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-white/30 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10"
        />

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[#0a0914] border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
            {availableTags.length > 0 ? (
              availableTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => assignTag(tag.id)}
                  className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${TAG_BADGE_COLORS[tag.color]?.split(" ")[0] || "bg-white/20"}`}
                  />
                  {tag.name}
                  {tag._count?.contacts != null && (
                    <span className="text-white/30 ml-auto">
                      {tag._count.contacts}
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-white/30">
                No matching tags
              </div>
            )}

            {/* Create new option */}
            {inputValue.trim() && !hasExactMatch && !showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full text-left px-3 py-2 text-xs text-blue-400 hover:bg-white/5 border-t border-white/10 transition-colors"
              >
                + Create &quot;{inputValue.trim()}&quot;
              </button>
            )}

            {/* Create form */}
            {showCreateForm && (
              <div className="p-3 border-t border-white/10 space-y-2">
                <p className="text-[10px] text-white/40 uppercase tracking-wider">
                  Pick a color
                </p>
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setNewTagColor(c.name)}
                      className={`w-6 h-6 rounded-full ${c.bg} transition-all ${
                        newTagColor === c.name
                          ? "ring-2 ring-white/50 scale-110"
                          : "opacity-60 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={createAndAssign}
                  className="w-full text-xs bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-lg py-1.5 transition-colors"
                >
                  Create &amp; Add
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
