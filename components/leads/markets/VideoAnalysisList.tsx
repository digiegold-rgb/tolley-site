"use client";

interface VideoDataPoint {
  id: string;
  title: string;
  url?: string;
  summary?: string;
  signal?: string;
  signalConfidence?: number;
  sentiment?: number;
  publishedAt?: string;
  createdAt: string;
}

interface Props {
  videos: VideoDataPoint[];
}

function getImpactLevel(v: VideoDataPoint): { label: string; color: string } {
  const impact = Math.abs(v.sentiment ?? 0) * (v.signalConfidence ?? 0.5);
  if (impact >= 0.5) return { label: "HIGH IMPACT", color: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20" };
  if (impact >= 0.25) return { label: "MED IMPACT", color: "text-amber-300 bg-amber-500/10 border-amber-500/20" };
  return { label: "", color: "" };
}

export default function VideoAnalysisList({ videos }: Props) {
  if (videos.length === 0) {
    return (
      <div className="text-center py-8 text-white/30 text-sm">
        No video analyses yet. Submit a YouTube URL to get started.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {videos.map((v) => {
        const signalColor =
          v.signal === "buy" ? "text-green-400" :
          v.signal === "sell" ? "text-red-400" :
          v.signal === "hold" ? "text-yellow-400" : "text-white/40";

        const impact = getImpactLevel(v);

        return (
          <div key={v.id} className="rounded-lg bg-white/5 border border-white/5 p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                {v.url ? (
                  <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-cyan-300 hover:text-cyan-200 line-clamp-1">
                    {v.title}
                  </a>
                ) : (
                  <span className="text-sm font-medium text-white line-clamp-1">{v.title}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {impact.label && (
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${impact.color}`}>
                    {impact.label}
                  </span>
                )}
                {v.signal && (
                  <span className={`text-xs font-bold uppercase ${signalColor}`}>
                    {v.signal}
                  </span>
                )}
              </div>
            </div>
            {v.summary && (
              <p className="text-xs text-white/50 mb-2 line-clamp-3">{v.summary}</p>
            )}
            <div className="flex items-center gap-3 text-[10px] text-white/30">
              {v.signalConfidence != null && (
                <span>Confidence: {Math.round(v.signalConfidence * 100)}%</span>
              )}
              {v.sentiment != null && (
                <span>Sentiment: {v.sentiment > 0 ? "+" : ""}{v.sentiment.toFixed(2)}</span>
              )}
              <span>{new Date(v.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
