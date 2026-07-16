"use client";

/**
 * Finished research answer: markdown with clickable citations, a
 * color-banded confidence badge, per-claim ✓ verified / ⚠ unverified
 * rows with their source links, and a cached-answer indicator.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface AnswerSource {
  url: string;
  title: string;
  quote?: string;
}

export interface AnswerClaim {
  text: string;
  sources: AnswerSource[];
  verified: boolean;
  confidence: number;
}

export interface AnswerData {
  answerMarkdown: string;
  claims: AnswerClaim[];
  unverifiedNotes?: string;
}

function confidenceColor(c: number): { bg: string; border: string; fg: string } {
  if (c >= 75) return { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.4)", fg: "#4ade80" };
  if (c >= 50) return { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.4)", fg: "#fbbf24" };
  return { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", fg: "#f87171" };
}

export function ResearchAnswer({
  answer,
  confidence,
  cached,
  similarity,
  completedAt,
}: {
  answer: AnswerData;
  confidence: number | null;
  cached?: boolean;
  similarity?: number;
  completedAt?: string | Date | null;
}) {
  const conf = confidence ?? 0;
  const cc = confidenceColor(conf);
  const verified = answer.claims.filter((c) => c.verified).length;

  return (
    <div
      style={{
        padding: 20,
        borderRadius: 16,
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Badges */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <span
          style={{
            padding: "5px 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            background: cc.bg,
            border: `1px solid ${cc.border}`,
            color: cc.fg,
          }}
        >
          Confidence {conf}/100
        </span>
        {answer.claims.length > 0 && (
          <span
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              fontSize: 12,
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            {verified}/{answer.claims.length} claims verified
          </span>
        )}
        {cached && (
          <span
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              background: "rgba(6,182,212,0.15)",
              border: "1px solid rgba(6,182,212,0.4)",
              color: "#67e8f9",
            }}
          >
            ⚡ instant — previously researched{similarity !== undefined && similarity < 1 ? ` (${Math.round(similarity * 100)}% match)` : ""}
          </span>
        )}
        {completedAt && (
          <span style={{ padding: "5px 0", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            researched {new Date(completedAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Answer body */}
      <div className="research-md">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#67e8f9" }}>
                {children}
              </a>
            ),
          }}
        >
          {answer.answerMarkdown}
        </ReactMarkdown>
      </div>

      {/* Claims ledger */}
      {answer.claims.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3
            style={{
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              color: "rgba(255,255,255,0.35)",
              marginBottom: 10,
            }}
          >
            Claim-by-claim sources
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {answer.claims.map((claim, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(0,0,0,0.25)",
                  border: `1px solid ${claim.verified ? "rgba(34,197,94,0.25)" : "rgba(245,158,11,0.25)"}`,
                }}
              >
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 6 }}>
                  <span style={{ marginRight: 8 }}>{claim.verified ? "✅" : "⚠️"}</span>
                  {claim.text}
                  <span style={{ marginLeft: 8, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                    {claim.verified ? "verified" : "unverified"} · {claim.confidence}/100
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {claim.sources.map((s, j) => (
                    <a
                      key={j}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "#67e8f9", wordBreak: "break-all" }}
                      title={s.quote}
                    >
                      ↗ {s.title || s.url}
                    </a>
                  ))}
                  {claim.sources.length === 0 && (
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>no source provided</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {answer.unverifiedNotes && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.25)",
            fontSize: 12.5,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          <strong style={{ color: "#fbbf24" }}>Could not verify:</strong> {answer.unverifiedNotes}
        </div>
      )}

      <style>{`
        .research-md {
          font-size: 14.5px;
          line-height: 1.65;
          color: rgba(255, 255, 255, 0.85);
        }
        .research-md h1, .research-md h2, .research-md h3 {
          color: white;
          font-weight: 800;
          margin: 18px 0 8px;
        }
        .research-md h1 { font-size: 20px; }
        .research-md h2 { font-size: 17px; }
        .research-md h3 { font-size: 15px; }
        .research-md p { margin: 8px 0; }
        .research-md ul, .research-md ol { margin: 8px 0 8px 20px; }
        .research-md li { margin: 3px 0; }
        .research-md code {
          background: rgba(0, 0, 0, 0.35);
          padding: 1px 5px;
          border-radius: 5px;
          font-size: 13px;
        }
        .research-md table {
          border-collapse: collapse;
          margin: 12px 0;
          display: block;
          overflow-x: auto;
          max-width: 100%;
        }
        .research-md th, .research-md td {
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 6px 10px;
          font-size: 13px;
          text-align: left;
        }
        .research-md th {
          background: rgba(255, 255, 255, 0.05);
          color: white;
        }
      `}</style>
    </div>
  );
}
