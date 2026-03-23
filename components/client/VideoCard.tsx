import { SentimentTag } from "./SentimentTag";
import type { NewsItem } from "./NewsCard";

function getYouTubeThumbnail(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId: string | null = null;
    if (u.hostname.includes("youtube.com")) {
      videoId = u.searchParams.get("v");
    } else if (u.hostname === "youtu.be") {
      videoId = u.pathname.slice(1);
    }
    if (videoId) return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  } catch {
    // ignore
  }
  return null;
}

/* eslint-disable @next/next/no-img-element */
export function VideoCard({ item }: { item: NewsItem }) {
  const thumb = item.url ? getYouTubeThumbnail(item.url) : null;
  const date = item.publishedAt || item.createdAt;
  const dateStr = date
    ? new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <div className="cl-card" style={{ padding: 0, overflow: "hidden" }}>
      {thumb && (
        <a
          href={item.url!}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block" }}
        >
          <div
            style={{
              position: "relative",
              aspectRatio: "16 / 9",
              overflow: "hidden",
              background: "#1e293b",
            }}
          >
            <img
              src={thumb}
              alt={item.title}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* Play button overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="white"
                >
                  <polygon points="6,3 17,10 6,17" />
                </svg>
              </div>
            </div>
          </div>
        </a>
      )}
      <div style={{ padding: "1rem" }}>
        <a
          href={item.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "0.9rem",
            fontWeight: 700,
            color: "var(--cl-text)",
            textDecoration: "none",
            lineHeight: 1.3,
          }}
        >
          {item.title}
        </a>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "6px",
            fontSize: "0.75rem",
            color: "var(--cl-text-light)",
          }}
        >
          <span style={{ fontWeight: 600 }}>YouTube</span>
          {dateStr && <span>{dateStr}</span>}
          <SentimentTag sentiment={item.sentiment} />
        </div>
        {item.summary && (
          <p
            style={{
              marginTop: "6px",
              fontSize: "0.8rem",
              color: "var(--cl-text-muted)",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.summary}
          </p>
        )}
      </div>
    </div>
  );
}
