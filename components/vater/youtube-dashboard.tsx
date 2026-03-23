"use client";

import { useState } from "react";
import {
  DEMO_YOUTUBE_VIDEOS,
  DEMO_YOUTUBE_TRENDS,
  getDemoYouTubeStats,
  formatCurrency,
  type DemoYouTubeVideo,
} from "@/lib/vater/demo-data";

type ViewMode = "kanban" | "list";
const STAGES = ["idea", "script-ready", "in-production", "published"] as const;
const STAGE_LABELS: Record<string, string> = {
  idea: "Ideas",
  "script-ready": "Script Ready",
  "in-production": "In Production",
  published: "Published",
};

const nicheEmoji: Record<string, string> = {
  aviation: "✈️",
  finance: "💰",
  tech: "🤖",
  history: "📜",
  science: "🔬",
};

export function YouTubeDashboard() {
  const [videos, setVideos] = useState<DemoYouTubeVideo[]>(DEMO_YOUTUBE_VIDEOS);
  const [view, setView] = useState<ViewMode>("kanban");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mobileStage, setMobileStage] = useState<(typeof STAGES)[number]>("idea");

  const stats = getDemoYouTubeStats(videos);

  const advanceStage = (id: string) => {
    setVideos((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;
        const idx = STAGES.indexOf(v.stage as (typeof STAGES)[number]);
        if (idx < STAGES.length - 1) {
          const nextStage = STAGES[idx + 1];
          return {
            ...v,
            stage: nextStage,
            publishedAt: nextStage === "published" ? new Date().toISOString() : v.publishedAt,
            views: nextStage === "published" ? Math.floor(Math.random() * 50000) + 5000 : v.views,
            retention: nextStage === "published" ? Math.floor(Math.random() * 20) + 45 : v.retention,
            revenue: nextStage === "published" ? Math.floor(Math.random() * 250) + 50 : v.revenue,
          };
        }
        return v;
      })
    );
    setExpanded(null);
  };

  const generateScript = (id: string) => {
    setVideos((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;
        return {
          ...v,
          stage: "script-ready" as const,
          scriptPreview: `[AI-generated script for "${v.title}"]\n\nHook: Did you know that most people have no idea about this? In this video, we'll reveal the truth behind ${v.title.toLowerCase()}...\n\nSection 1: The Setup\nSection 2: The Evidence\nSection 3: Why It Matters\nSection 4: What You Can Do`,
        };
      })
    );
    setExpanded(null);
  };

  const createFromTrend = (topic: string) => {
    const newVideo: DemoYouTubeVideo = {
      id: `demo-yt-gen-${Date.now()}`,
      title: topic.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      niche: "tech",
      stage: "idea",
      views: 0,
      retention: 0,
      revenue: 0,
      scriptPreview: "",
      thumbnailUrl: `https://placehold.co/640x360/0f172a/a78bfa?text=New+Idea`,
      publishedAt: null,
    };
    setVideos((prev) => [newVideo, ...prev]);
  };

  const byStage = (stage: string) => videos.filter((v) => v.stage === stage);

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="vater-section-title mb-3">YouTube Dashboard</h2>
      <p className="vater-section-subtitle mb-8">
        Faceless content pipeline — idea to published.
        <span className="ml-2 text-xs text-sky-400/60">(Demo Data)</span>
      </p>

      {/* Channel Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="vater-stat-card">
          <div className="vater-stat-value">{stats.subscribers.toLocaleString()}</div>
          <div className="vater-stat-label">Subscribers</div>
        </div>
        <div className="vater-stat-card">
          <div className="vater-stat-value">{(stats.monthlyViews / 1000).toFixed(0)}K</div>
          <div className="vater-stat-label">Monthly Views</div>
        </div>
        <div className="vater-stat-card">
          <div className="vater-stat-value">${stats.monthlyRevenue.toLocaleString()}</div>
          <div className="vater-stat-label">Est. Revenue</div>
        </div>
        <div className="vater-stat-card">
          <div className="vater-stat-value">+{stats.growthRate}%</div>
          <div className="vater-stat-label">Growth Rate</div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={() => setView("kanban")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-all ${
            view === "kanban"
              ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
              : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-500"
          }`}
        >
          Kanban
        </button>
        <button
          onClick={() => setView("list")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-all ${
            view === "list"
              ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
              : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-500"
          }`}
        >
          List
        </button>
      </div>

      <div className="flex gap-6 lg:flex-row flex-col">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {view === "kanban" ? (
            <>
              {/* Mobile stage tabs */}
              <div className="mb-4 flex flex-wrap gap-2 sm:hidden">
                {STAGES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setMobileStage(s)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all ${
                      mobileStage === s
                        ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                        : "bg-slate-800/50 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {STAGE_LABELS[s]} ({byStage(s).length})
                  </button>
                ))}
              </div>

              {/* Desktop kanban */}
              <div className="vater-kanban hidden sm:flex">
                {STAGES.map((stage) => (
                  <div key={stage} className="flex-1 min-w-0">
                    <div className="mb-3 rounded-lg bg-slate-800/50 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {STAGE_LABELS[stage]} ({byStage(stage).length})
                    </div>
                    <div className="vater-kanban-column space-y-3">
                      {byStage(stage).map((v) => (
                        <VideoCard
                          key={v.id}
                          video={v}
                          compact
                          expanded={expanded === v.id}
                          onToggle={() => setExpanded(expanded === v.id ? null : v.id)}
                          onAdvance={() => advanceStage(v.id)}
                          onGenScript={() => generateScript(v.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile single column */}
              <div className="space-y-3 sm:hidden">
                {byStage(mobileStage).map((v) => (
                  <VideoCard
                    key={v.id}
                    video={v}
                    compact={false}
                    expanded={expanded === v.id}
                    onToggle={() => setExpanded(expanded === v.id ? null : v.id)}
                    onAdvance={() => advanceStage(v.id)}
                    onGenScript={() => generateScript(v.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            /* List view */
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <div className="col-span-1">Niche</div>
                <div className="col-span-4">Title</div>
                <div className="col-span-2">Stage</div>
                <div className="col-span-2 text-right">Views</div>
                <div className="col-span-1 text-right">Ret.</div>
                <div className="col-span-2 text-right">Revenue</div>
              </div>
              {videos.map((v) => (
                <div
                  key={v.id}
                  className="vater-card cursor-pointer p-4 transition-all"
                  onClick={() => setExpanded(expanded === v.id ? null : v.id)}
                >
                  <div className="sm:grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-1 text-lg">{nicheEmoji[v.niche]}</div>
                    <div className="col-span-4 text-sm font-medium text-slate-200 leading-tight">{v.title}</div>
                    <div className="col-span-2">
                      <span className={`vater-badge vater-badge-${v.stage === "published" ? "won" : v.stage === "in-production" ? "pending" : v.stage === "script-ready" ? "open" : "design-ready"}`}>
                        {STAGE_LABELS[v.stage]}
                      </span>
                    </div>
                    <div className="col-span-2 text-right text-sm text-slate-400">
                      {v.views > 0 ? `${(v.views / 1000).toFixed(1)}K` : "—"}
                    </div>
                    <div className="col-span-1 text-right text-sm text-slate-400">
                      {v.retention > 0 ? `${v.retention}%` : "—"}
                    </div>
                    <div className="col-span-2 text-right text-sm font-semibold text-green-400">
                      {v.revenue > 0 ? `$${v.revenue}` : "—"}
                    </div>
                  </div>
                  {expanded === v.id && (
                    <div className="mt-3 border-t border-slate-700/50 pt-3">
                      {v.scriptPreview && (
                        <p className="mb-3 rounded bg-slate-800/50 p-3 text-xs text-slate-400 leading-relaxed font-mono whitespace-pre-line">
                          {v.scriptPreview}
                        </p>
                      )}
                      <div className="flex gap-2">
                        {v.stage !== "published" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); advanceStage(v.id); }}
                            className="vater-cta text-xs"
                          >
                            Advance Stage
                          </button>
                        )}
                        {v.stage === "idea" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); generateScript(v.id); }}
                            className="rounded-lg border border-sky-500/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-sky-400 transition hover:bg-sky-500/10"
                          >
                            Generate Script
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trending Topics Sidebar */}
        <div className="lg:w-72 flex-shrink-0">
          <div className="vater-card p-4">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-300">
              Trending Topics
            </h3>
            <div className="space-y-3">
              {DEMO_YOUTUBE_TRENDS.map((t) => (
                <div key={t.id} className="border-b border-slate-700/30 pb-3 last:border-b-0 last:pb-0">
                  <p className="mb-1 text-xs font-medium text-slate-200 leading-tight">{t.topic}</p>
                  <div className="mb-1.5 flex items-center gap-2 text-[10px] text-slate-500">
                    <span>{(t.searchVolume / 1000).toFixed(0)}K vol</span>
                    <span className={`rounded px-1 py-0.5 ${
                      t.competition === "low" ? "bg-green-500/10 text-green-400" :
                      t.competition === "medium" ? "bg-amber-500/10 text-amber-400" :
                      "bg-red-500/10 text-red-400"
                    }`}>
                      {t.competition}
                    </span>
                    <span>${t.estimatedCPM} CPM</span>
                  </div>
                  <button
                    onClick={() => createFromTrend(t.topic)}
                    className="text-[10px] font-semibold uppercase tracking-wider text-sky-400 hover:text-sky-300 transition"
                  >
                    + Generate Script
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function VideoCard({
  video: v,
  compact,
  expanded,
  onToggle,
  onAdvance,
  onGenScript,
}: {
  video: DemoYouTubeVideo;
  compact: boolean;
  expanded: boolean;
  onToggle: () => void;
  onAdvance: () => void;
  onGenScript: () => void;
}) {
  return (
    <div
      className="vater-card cursor-pointer p-3 transition-all"
      onClick={onToggle}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm">{nicheEmoji[v.niche]}</span>
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
          {v.niche}
        </span>
      </div>
      <h4 className={`font-semibold text-slate-200 leading-tight ${compact ? "text-xs" : "text-sm"}`}>
        {v.title}
      </h4>
      {v.stage === "published" && (
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400">
          <span>{(v.views / 1000).toFixed(1)}K views</span>
          <span className="text-green-400 font-semibold">${v.revenue}</span>
        </div>
      )}

      {expanded && (
        <div className="mt-3 border-t border-slate-700/50 pt-3">
          {v.scriptPreview && (
            <p className="mb-2 text-[11px] text-slate-400 leading-relaxed line-clamp-4">
              {v.scriptPreview}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {v.stage !== "published" && (
              <button
                onClick={(e) => { e.stopPropagation(); onAdvance(); }}
                className="vater-cta text-[10px] px-2 py-1"
              >
                Advance
              </button>
            )}
            {v.stage === "idea" && (
              <button
                onClick={(e) => { e.stopPropagation(); onGenScript(); }}
                className="rounded border border-sky-500/40 bg-transparent px-2 py-1 text-[10px] font-semibold text-sky-400 transition hover:bg-sky-500/10"
              >
                Gen Script
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
