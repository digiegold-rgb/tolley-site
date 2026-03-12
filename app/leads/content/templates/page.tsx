"use client";

import { useState, useEffect, useCallback } from "react";

interface Template {
  id: string;
  name: string;
  platform: string;
  category: string;
  promptTemplate: string;
  tone: string;
  isActive: boolean;
  subscriberId: string | null;
}

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  twitter: "X / Twitter",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  all: "All Platforms",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPlatform) params.set("platform", filterPlatform);
      if (filterCategory) params.set("category", filterCategory);
      const res = await fetch(`/api/content/templates?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filterPlatform, filterCategory]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await fetch("/api/content/templates/seed", { method: "POST" });
      fetchTemplates();
    } catch {
      // silent
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/content/templates/${id}`, { method: "DELETE" });
    fetchTemplates();
  };

  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <nav className="flex items-center gap-1 mb-6 flex-wrap">
          <a href="/leads/dashboard" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Leads</a>
          <span className="text-white/20">/</span>
          <a href="/leads/content" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Content</a>
          <span className="text-white/20">/</span>
          <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-white/10">Templates</span>
        </nav>

        <div className="flex gap-2 mb-6">
          <a href="/leads/content" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Hub</a>
          <a href="/leads/content/posts" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Posts</a>
          <span className="rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 text-xs font-medium">Templates</span>
          <a href="/leads/content/campaigns" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Campaigns</a>
          <a href="/leads/content/settings" className="rounded-lg bg-white/5 text-white/40 px-3 py-1 text-xs hover:text-white/60 transition-colors">Settings</a>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Content Templates</h1>
            <p className="text-white/40 text-sm mt-1">AI prompt templates for each platform and content type</p>
          </div>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            {seeding ? "Seeding..." : "Seed Defaults"}
          </button>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {["", "linkedin", "twitter", "facebook", "instagram"].map((p) => (
            <button
              key={p || "all"}
              onClick={() => setFilterPlatform(p)}
              className={`rounded-lg px-3 py-1 text-xs transition-colors ${
                filterPlatform === p
                  ? "bg-white/15 text-white/80"
                  : "bg-white/5 text-white/30 hover:text-white/50"
              }`}
            >
              {p ? PLATFORM_LABELS[p] : "All"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-white/30 text-sm">No templates. Click "Seed Defaults" to create standard templates.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white/80">{t.name}</div>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] text-purple-300/60 bg-purple-500/10 rounded px-1.5 py-0.5">
                      {PLATFORM_LABELS[t.platform] || t.platform}
                    </span>
                    <span className="text-[10px] text-white/30 bg-white/5 rounded px-1.5 py-0.5">
                      {t.category.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] text-white/20">{t.tone}</span>
                    {!t.subscriberId && (
                      <span className="text-[10px] text-yellow-300/40">system</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="text-xs text-white/20 hover:text-red-300 transition-colors ml-4"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
