"use client";

import { useState, useMemo } from "react";
import { NewsCard, type NewsItem } from "./NewsCard";
import { VideoCard } from "./VideoCard";

export function NewsFeed({ items }: { items: NewsItem[] }) {
  const [tab, setTab] = useState<"articles" | "videos">("articles");

  const articles = useMemo(
    () => items.filter((i) => i.type !== "youtube"),
    [items],
  );
  const videos = useMemo(
    () => items.filter((i) => i.type === "youtube"),
    [items],
  );

  const displayed = tab === "articles" ? articles : videos;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "var(--cl-text)",
          }}
        >
          News & Analysis
        </h2>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.75rem",
            color: "var(--cl-text-light)",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--cl-positive)",
              display: "inline-block",
              animation: "pulse 2s infinite",
            }}
          />
          Auto-refreshes every 5 min
        </div>
      </div>

      <div className="cl-tabs" style={{ marginBottom: "1.25rem" }}>
        <button
          className={`cl-tab ${tab === "articles" ? "active" : ""}`}
          onClick={() => setTab("articles")}
        >
          Articles ({articles.length})
        </button>
        <button
          className={`cl-tab ${tab === "videos" ? "active" : ""}`}
          onClick={() => setTab("videos")}
        >
          Videos ({videos.length})
        </button>
      </div>

      {tab === "articles" ? (
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
          }}
        >
          {displayed.slice(0, 12).map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {displayed.slice(0, 12).map((item) => (
            <VideoCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {!displayed.length && (
        <div
          className="cl-card-static"
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "var(--cl-text-muted)",
          }}
        >
          No {tab} available yet. Data is being collected by our AI agents.
        </div>
      )}
    </div>
  );
}
