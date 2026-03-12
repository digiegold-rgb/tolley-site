"use client";

interface Article {
  id: string;
  title: string;
  url?: string;
  summary?: string;
  signal?: string;
  sentiment?: number;
  createdAt: string;
}

interface Props {
  articles: Article[];
}

export default function BlogFeed({ articles }: Props) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-8 text-white/30 text-sm">
        No articles yet. Subscribe to RSS feeds or submit article URLs.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {articles.map((a) => {
        const sentimentDot =
          (a.sentiment ?? 0) > 0.2 ? "bg-green-400" :
          (a.sentiment ?? 0) < -0.2 ? "bg-red-400" : "bg-yellow-400";

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
              <span className="text-[10px] text-white/20 mt-1 inline-block">
                {new Date(a.createdAt).toLocaleDateString()}
              </span>
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
