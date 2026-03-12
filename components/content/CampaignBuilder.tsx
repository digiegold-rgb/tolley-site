"use client";

import { useState } from "react";
import PlatformPicker from "./PlatformPicker";

interface CampaignBuilderProps {
  onSave: (data: {
    name: string;
    description: string;
    platforms: string[];
    frequency: string;
    postsPerDay: number;
    preferredTimes: string[];
    sourceType: string;
  }) => void;
  saving?: boolean;
}

export default function CampaignBuilder({ onSave, saving }: CampaignBuilderProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [frequency, setFrequency] = useState("daily");
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [preferredTimes, setPreferredTimes] = useState(["09:00", "17:00"]);
  const [sourceType, setSourceType] = useState("ai_generated");

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-white/50 block mb-1">Campaign Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Weekly Market Updates"
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-500/50"
        />
      </div>

      <div>
        <label className="text-xs text-white/50 block mb-1">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this campaign does..."
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-500/50"
        />
      </div>

      <div>
        <label className="text-xs text-white/50 block mb-1.5">Platforms</label>
        <PlatformPicker
          selected={platforms}
          onChange={(v) => setPlatforms(v as string[])}
          multiple
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-white/50 block mb-1">Frequency</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-500/50"
          >
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays Only</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-white/50 block mb-1">Posts/Day</label>
          <input
            type="number"
            min={1}
            max={10}
            value={postsPerDay}
            onChange={(e) => setPostsPerDay(parseInt(e.target.value) || 1)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-500/50"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-white/50 block mb-1">Preferred Post Times</label>
        <div className="flex gap-2">
          {preferredTimes.map((t, i) => (
            <input
              key={i}
              type="time"
              value={t}
              onChange={(e) => {
                const updated = [...preferredTimes];
                updated[i] = e.target.value;
                setPreferredTimes(updated);
              }}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-500/50"
            />
          ))}
          <button
            onClick={() => setPreferredTimes([...preferredTimes, "12:00"])}
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/30 hover:text-white/60"
          >
            + Add
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs text-white/50 block mb-1">Content Source</label>
        <div className="flex gap-2">
          {[
            { id: "ai_generated", label: "AI Generated" },
            { id: "template_fill", label: "Template Fill" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setSourceType(s.id)}
              className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                sourceType === s.id
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "bg-white/5 text-white/30 border border-white/10"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() =>
          onSave({ name, description, platforms, frequency, postsPerDay, preferredTimes, sourceType })
        }
        disabled={!name || platforms.length === 0 || saving}
        className="w-full rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-2.5 text-sm font-medium text-white transition-colors"
      >
        {saving ? "Creating..." : "Create Campaign"}
      </button>
    </div>
  );
}
