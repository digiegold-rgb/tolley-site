"use client";

import { useState, useMemo } from "react";

interface Article {
  id: string;
  title: string;
  url?: string;
  summary?: string;
  signal?: string;
  sentiment?: number;
  signalConfidence?: number;
  createdAt: string;
}

interface Props {
  articles: Article[];
}

type SortMode = "recent" | "impact";

export default function BlogFeed({ articles }: Props) {
  const [showLowQuality, setShowLowQuality] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const filtered = useMemo(() => {
    let result = articles;
    if (!showLowQuality) {
      result = result.filter((a) => {
        const confidence = a.signalConfidence ?? 0.5;
        return confidence >= 0.3;
      });
    }
    if (sortMode === "impact") {
      result = [...result].sort((a, b) => {
        const aImpact = Math.abs(a.sentiment ?? 0) * (a.signalConfidence ?? 0.5);
        const bImpact = Math.abs(b.sentiment ?? 0) * (b.signalConfidence ?? 0.5);
        return bImpact - aImpact;
      });
    }
    return result;
  }, [articles, showLowQuality, sortMode]);

  if (articles.length === 0) {
    return (
      <div className="text-center py-8 text-white/30 text-sm">
        No articles yet. Subscribe to RSS feeds or submit article URLs.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Filters */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => setSortMode(sortMode === "recent" ? "impact" : "recent")}
          className="text-[10px] text-white/40 hover:text-white/60 transition-colors"
        >
          Sort: {sortMode === "recent" ? "Recent" : "Impact"}
        </button>
        <button
          onClick={() => setShowLowQuality(!showLowQuality)}
          className={`text-[10px] transition-colors ${showLowQuality ? "text-white/40 hover:text-white/60" : "text-cyan-300"}`}
        >
          {showLowQuality ? "Show All" : "Filtered"}
        </button>
        <span className="text-[10px] text-white/20">{filtered.length} articles</span>
      </div>

      {filtered.map((a) => {
        const sentimentDot =
          (a.sentiment ?? 0) > 0.2 ? "bg-green-400" :
          (a.sentiment ?? 0) < -0.2 ? "bg-red-400" : "bg-yellow-400";

        const confidence = a.signalConfidence ?? 0;
        const reputationBadge =
          confidence >= 0.7 ? { label: "HIGH", color: "text-green-400/70" } :
          confidence >= 0.4 ? { label: "MED", color: "text-yellow-400/70" } :
          { label: "LOW", color: "text-white/20" };

        return (
          <div key={a.id} className="flex items-start gap-3 rounded-lg bg-white/5 border border-white/5 p-3">
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${sentimentDot}`} />
            <div className="flex-1 min-w-0">
              {a.url ? (
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm text-cyan-300 hover:text-cyan-200 line-clamp-1">
                  {a.title}
                </a>
              ) : (
                <span className="text-sm text-white line-clamp-1">{a.title}</span>
              )}
              {a.summary && (
                <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{a.summary}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-white/20">
                  {new Date(a.createdAt).toLocaleDateString()}
                </span>
                <span className={`text-[9px] font-medium ${reputationBadge.color}`}>
                  {reputationBadge.label}
                </span>
              </div>
            </div>
            {a.signal && (
              <span className={`text-[10px] font-bold uppercase shrink-0 ${
                a.signal === "buy" ? "text-green-400" :
                a.signal === "sell" ? "text-red-400" : "text-yellow-400"
              }`}>
                {a.signal}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
