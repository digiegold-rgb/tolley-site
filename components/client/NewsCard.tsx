import { SentimentTag } from "./SentimentTag";

export interface NewsItem {
  id: string;
  type: string;
  title: string;
  url?: string;
  summary: string | null;
  sentiment: number | null;
  signal: string | null;
  tags: string[];
  publishedAt: string | null;
  createdAt: string;
}

export function NewsCard({ item }: { item: NewsItem }) {
  const date = item.publishedAt || item.createdAt;
  const dateStr = date
    ? new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "";

  const source =
    item.url && item.type === "article"
      ? new URL(item.url).hostname.replace("www.", "")
      : item.type === "youtube"
        ? "YouTube"
        : item.type;

  return (
    <div className="cl-card" style={{ padding: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "8px",
        }}
      >
        <div style={{ flex: 1 }}>
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "var(--cl-text)",
                textDecoration: "none",
                lineHeight: 1.3,
              }}
            >
              {item.title}
            </a>
          ) : (
            <div
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "var(--cl-text)",
                lineHeight: 1.3,
              }}
            >
              {item.title}
            </div>
          )}
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
            <span style={{ fontWeight: 600 }}>{source}</span>
            {dateStr && <span>{dateStr}</span>}
            <SentimentTag sentiment={item.sentiment} />
          </div>
        </div>
        {item.signal && (
          <span
            className={`cl-badge-${item.signal.toLowerCase()}`}
            style={{
              padding: "2px 8px",
              borderRadius: "6px",
              fontSize: "0.65rem",
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {item.signal}
          </span>
        )}
      </div>
      {item.summary && (
        <p
          style={{
            marginTop: "8px",
            fontSize: "0.82rem",
            color: "var(--cl-text-muted)",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.summary}
        </p>
      )}
    </div>
  );
}
