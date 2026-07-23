"use client";

import { useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { readApiError } from "./types";

export interface MustCompleteItem {
  id: string;
  sortOrder: number;
  priority: string; // red | yellow | green
  category: string;
  title: string;
  detail: string | null;
  links: { label: string; url: string }[];
  command: string | null;
  afterNote: string | null;
  status: string;
  source: string;
  createdAt: string;
  completedAt: string | null;
}

const PRIORITY_COLOR: Record<string, string> = {
  red: "#dc2626",
  yellow: "#a16207",
  green: "#15803d",
};

const PRIORITY_LABEL: Record<string, string> = {
  red: "DO FIRST",
  yellow: "THIS WEEK",
  green: "WHEN FREE",
};

const CATEGORY_STYLE: Record<string, { bg: string; fg: string }> = {
  billing: { bg: "#fee2e2", fg: "#b91c1c" },
  estate: { bg: "#dcfce7", fg: "#15803d" },
  social: { bg: "#dbeafe", fg: "#1d4ed8" },
  money: { bg: "#fef9c3", fg: "#a16207" },
  growth: { bg: "#ede9fe", fg: "#6d28d9" },
  decision: { bg: "#fce7f3", fg: "#be185d" },
  infra: { bg: "#f0f0f5", fg: "#3a3a3c" },
  amazon: { bg: "#ffedd5", fg: "#c2410c" },
  signups: { bg: "#ccfbf1", fg: "#0f766e" },
  general: { bg: "#f0f0f5", fg: "#3a3a3c" },
};

function CategoryPill({ category }: { category: string }) {
  const s = CATEGORY_STYLE[category] ?? CATEGORY_STYLE.general;
  return (
    <span className="pill" style={{ background: s.bg, color: s.fg }}>
      {category}
    </span>
  );
}

export function HqMustComplete({
  open,
  done,
  loading,
  busyId,
  onRefresh,
  onSetStatus,
}: {
  open: MustCompleteItem[];
  done: MustCompleteItem[];
  loading: boolean;
  busyId: string | null;
  onRefresh: () => void;
  onSetStatus: (id: string, status: "open" | "done" | "dismissed") => Promise<boolean>;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showDone, setShowDone] = useState(false);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyCommand(cmd: string) {
    try {
      await navigator.clipboard.writeText(cmd);
      toast({ title: "Command copied", variant: "success" });
    } catch {
      toast({ title: "Copy failed — select the text manually", variant: "error" });
    }
  }

  const redCount = open.filter((i) => i.priority === "red").length;

  return (
    <div>
      <div className="panel" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          Everything that needs YOU — in order. Nothing else does.
        </div>
        <div style={{ fontSize: 11, color: "#6e6e73" }}>
          Work top to bottom. Claude adds new blockers here automatically; when an item says
          &ldquo;then tell Claude…&rdquo;, that message is what fires the machine side.
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span className="pill" style={{ background: "#fee2e2", color: "#b91c1c" }}>
            {redCount} do-first
          </span>
          <span className="pill" style={{ background: "#f0f0f5", color: "#3a3a3c" }}>
            {open.length} open
          </span>
          <button className="btn btn-sm" onClick={onRefresh} disabled={loading}>
            ↻
          </button>
        </div>
      </div>

      {loading && open.length === 0 ? (
        <div style={{ color: "#666", padding: 20 }}>Loading…</div>
      ) : open.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: 30 }}>
          <div style={{ fontSize: 28 }}>🏁</div>
          <div style={{ fontWeight: 700, marginTop: 6 }}>Queue is empty.</div>
          <div style={{ fontSize: 11, color: "#6e6e73", marginTop: 2 }}>
            The machine runs itself — your job is phone calls, decisions, and being the licensed agent.
          </div>
        </div>
      ) : (
        open.map((item, idx) => {
          const isOpen = expanded.has(item.id);
          const busy = busyId === item.id;
          return (
            <div
              key={item.id}
              className="panel"
              style={{
                borderLeft: `4px solid ${PRIORITY_COLOR[item.priority] ?? "#9ca3af"}`,
                marginBottom: 10,
                padding: "10px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: "#9ca3af",
                    minWidth: 26,
                    lineHeight: "20px",
                  }}
                >
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span
                      className="pill"
                      style={{
                        background: PRIORITY_COLOR[item.priority] ?? "#9ca3af",
                        color: "#fff",
                      }}
                    >
                      {PRIORITY_LABEL[item.priority] ?? item.priority}
                    </span>
                    <CategoryPill category={item.category} />
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{item.title}</span>
                  </div>

                  {/* Clickable links — always visible, these ARE the steps */}
                  {item.links.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {item.links.map((l, i) => (
                        <a
                          key={i}
                          className="btn btn-sm"
                          href={l.url}
                          target={l.url.startsWith("tel:") ? undefined : "_blank"}
                          rel="noreferrer"
                          style={{ textDecoration: "none", display: "inline-block", color: "#1d4ed8", borderColor: "#bfdbfe", background: "#eff6ff" }}
                        >
                          {l.url.startsWith("tel:") ? "📞 " : "🔗 "}
                          {l.label}
                        </a>
                      ))}
                    </div>
                  )}

                  {isOpen && item.detail && (
                    <div
                      className="touch-body"
                      style={{ marginTop: 8, background: "#f9f9fb", borderRadius: 8, padding: "8px 10px" }}
                    >
                      {item.detail}
                    </div>
                  )}

                  {isOpen && item.command && (
                    <div style={{ marginTop: 8 }}>
                      <pre
                        style={{
                          background: "#1d1d1f",
                          color: "#a7f3d0",
                          borderRadius: 8,
                          padding: "8px 10px",
                          fontSize: 11,
                          overflowX: "auto",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                          margin: 0,
                        }}
                      >
                        {item.command}
                      </pre>
                      <button
                        className="btn btn-sm"
                        style={{ marginTop: 4 }}
                        onClick={() => copyCommand(item.command!)}
                      >
                        📋 Copy command
                      </button>
                    </div>
                  )}

                  {item.afterNote && (
                    <div style={{ marginTop: 8, fontSize: 11, color: "#6d28d9", fontWeight: 600 }}>
                      ✅ When done: {item.afterNote}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={busy}
                    onClick={() => onSetStatus(item.id, "done")}
                  >
                    {busy ? "…" : "✓ Done"}
                  </button>
                  {(item.detail || item.command) && (
                    <button className="btn btn-sm" onClick={() => toggle(item.id)}>
                      {isOpen ? "Hide" : "Details"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Completed */}
      {done.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-sm" onClick={() => setShowDone((v) => !v)}>
            {showDone ? "▾" : "▸"} Completed ({done.length})
          </button>
          {showDone &&
            done.map((item) => (
              <div
                key={item.id}
                className="panel"
                style={{ opacity: 0.65, marginTop: 8, marginBottom: 0, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}
              >
                <span>{item.status === "dismissed" ? "🚫" : "✅"}</span>
                <CategoryPill category={item.category} />
                <span style={{ fontSize: 12, textDecoration: "line-through" }}>{item.title}</span>
                <span style={{ fontSize: 10, color: "#9ca3af" }}>
                  {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : ""}
                </span>
                <button
                  className="btn btn-sm"
                  style={{ marginLeft: "auto" }}
                  disabled={busyId === item.id}
                  onClick={() => onSetStatus(item.id, "open")}
                >
                  ↩ Reopen
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
