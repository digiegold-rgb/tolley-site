"use client";

import { useState, useEffect } from "react";

interface AutoResponderData {
  id?: string;
  isActive: boolean;
  triggerSource: string[];
  minScore: number;
  promptId: string;
  delaySeconds: number;
  maxPerDay: number;
  notifyPhone: string;
  notifyEmail: string;
  notifyMinScore: number;
  activeStartHour: number;
  activeEndHour: number;
  timezone: string;
  sentToday: number;
}

interface Limits {
  autoResponseLimit: number;
  agentNotify: boolean;
}

const TRIGGER_SOURCES = [
  { id: "mls_expired", label: "Expired Listings" },
  { id: "mls_pricedrop", label: "Price Drops" },
  { id: "mls_dom", label: "High Days on Market" },
  { id: "snap", label: "Snap & Know" },
  { id: "csv", label: "CSV Import" },
];

const PROMPT_OPTIONS = [
  { id: "speed_to_lead_seller", label: "Seller Outreach" },
  { id: "speed_to_lead_buyer", label: "Buyer Outreach" },
  { id: "real_estate_leads", label: "Lead Nurture" },
];

export default function AutoResponderConfig() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [limits, setLimits] = useState<Limits>({ autoResponseLimit: 0, agentNotify: false });
  const [config, setConfig] = useState<AutoResponderData>({
    isActive: false,
    triggerSource: ["mls_expired", "mls_pricedrop", "mls_dom"],
    minScore: 30,
    promptId: "speed_to_lead_seller",
    delaySeconds: 30,
    maxPerDay: 20,
    notifyPhone: "",
    notifyEmail: "",
    notifyMinScore: 60,
    activeStartHour: 9,
    activeEndHour: 20,
    timezone: "America/Chicago",
    sentToday: 0,
  });

  useEffect(() => {
    fetch("/api/leads/auto-responder")
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          setConfig({
            ...data.config,
            notifyPhone: data.config.notifyPhone || "",
            notifyEmail: data.config.notifyEmail || "",
          });
        }
        if (data.limits) setLimits(data.limits);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/leads/auto-responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.config) setConfig({ ...data.config, notifyPhone: data.config.notifyPhone || "", notifyEmail: data.config.notifyEmail || "" });
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const toggleSource = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      triggerSource: prev.triggerSource.includes(id)
        ? prev.triggerSource.filter((s) => s !== id)
        : [...prev.triggerSource, id],
    }));
  };

  if (loading) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] mb-6 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${config.isActive ? "bg-green-400 animate-pulse" : "bg-white/20"}`} />
          <span className="text-sm font-medium text-white/80">Speed-to-Lead Auto-Response</span>
          {config.isActive && (
            <span className="text-xs text-white/30">
              {config.sentToday}/{config.maxPerDay} today
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-white/40 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded config */}
      {expanded && (
        <div className="border-t border-white/10 px-4 py-4 space-y-4">
          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-white/60">Auto-Response Active</label>
            <button
              onClick={() => setConfig((p) => ({ ...p, isActive: !p.isActive }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                config.isActive ? "bg-green-500" : "bg-white/20"
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  config.isActive ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Trigger sources */}
          <div>
            <label className="text-sm text-white/60 block mb-2">Trigger On</label>
            <div className="flex flex-wrap gap-2">
              {TRIGGER_SOURCES.map((src) => (
                <button
                  key={src.id}
                  onClick={() => toggleSource(src.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    config.triggerSource.includes(src.id)
                      ? "bg-purple-500/30 text-purple-200 border border-purple-500/40"
                      : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  {src.label}
                </button>
              ))}
            </div>
          </div>

          {/* Min score + prompt */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-white/60 block mb-1">Min Score</label>
              <input
                type="number"
                min={0}
                max={100}
                value={config.minScore}
                onChange={(e) => setConfig((p) => ({ ...p, minScore: parseInt(e.target.value) || 0 }))}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div>
              <label className="text-sm text-white/60 block mb-1">AI Prompt</label>
              <select
                value={config.promptId}
                onChange={(e) => setConfig((p) => ({ ...p, promptId: e.target.value }))}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-500/50"
              >
                {PROMPT_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Delay + daily cap */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-white/60 block mb-1">Delay (seconds)</label>
              <input
                type="number"
                min={10}
                max={300}
                value={config.delaySeconds}
                onChange={(e) => setConfig((p) => ({ ...p, delaySeconds: parseInt(e.target.value) || 30 }))}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div>
              <label className="text-sm text-white/60 block mb-1">
                Max/Day <span className="text-white/30">(limit: {limits.autoResponseLimit})</span>
              </label>
              <input
                type="number"
                min={1}
                max={limits.autoResponseLimit}
                value={config.maxPerDay}
                onChange={(e) => setConfig((p) => ({ ...p, maxPerDay: Math.min(parseInt(e.target.value) || 1, limits.autoResponseLimit) }))}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-500/50"
              />
            </div>
          </div>

          {/* Active hours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-white/60 block mb-1">Active Start (hour)</label>
              <input
                type="number"
                min={0}
                max={23}
                value={config.activeStartHour}
                onChange={(e) => setConfig((p) => ({ ...p, activeStartHour: parseInt(e.target.value) || 0 }))}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div>
              <label className="text-sm text-white/60 block mb-1">Active End (hour)</label>
              <input
                type="number"
                min={0}
                max={23}
                value={config.activeEndHour}
                onChange={(e) => setConfig((p) => ({ ...p, activeEndHour: parseInt(e.target.value) || 23 }))}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-500/50"
              />
            </div>
          </div>

          {/* Agent notifications (Pro+ only) */}
          {limits.agentNotify && (
            <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-3">
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider">
                Agent Notifications (High-Score Leads)
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-white/60 block mb-1">Notify Phone</label>
                  <input
                    type="tel"
                    placeholder="+1..."
                    value={config.notifyPhone}
                    onChange={(e) => setConfig((p) => ({ ...p, notifyPhone: e.target.value }))}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="text-sm text-white/60 block mb-1">Min Score to Notify</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={config.notifyMinScore}
                    onChange={(e) => setConfig((p) => ({ ...p, notifyMinScore: parseInt(e.target.value) || 60 }))}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-2.5 text-sm font-medium text-white transition-colors"
          >
            {saving ? "Saving..." : "Save Auto-Response Settings"}
          </button>
        </div>
      )}
    </div>
  );
}
