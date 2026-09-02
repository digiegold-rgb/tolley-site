"use client";

import { useEffect, useRef, useState } from "react";

// Live reference panel at the top of /tv: tail of the DGX tv-unstick self-heal log
// (~/logs/tv-unstick.log) + Radarr/Sonarr queue snapshot. Data via /api/tv/pipeline
// → DGX tv-api :8777 (tv-dvr.tolley.io). Polls every 20s.

type QueueItem = {
  title: string;
  status: string;
  state: string;
  leftGB: number;
  pct: number | null;
  msg: string;
};
type Arr = { wanted: number | null; queue: QueueItem[]; error?: string };
type Pipeline = {
  log: string[];
  lastRun: string | null;
  nextRun: string | null;
  radarr: Arr;
  sonarr: Arr;
  at: string;
};

const LS_KEY = "tv-pipeline-collapsed";

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function stateColor(it: QueueItem) {
  if (it.state === "importBlocked" || it.state === "importPending" || it.status === "warning") return "#fbbf24";
  if (it.status === "completed") return "#34d399";
  if (it.status === "queued" || (it.pct ?? 0) === 0) return "rgba(255,255,255,0.45)";
  return "#60a5fa";
}

function QueueList({ label, arr }: { label: string; arr: Arr }) {
  return (
    <div style={{ flex: 1, minWidth: 260 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11.5,
          color: "rgba(255,255,255,0.5)",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        <span>{label} queue · {arr.queue?.length ?? 0}</span>
        <span>wanted {arr.wanted ?? "—"}</span>
      </div>
      {arr.error ? (
        <div style={{ fontSize: 12, color: "#f87171" }}>⚠️ {arr.error}</div>
      ) : arr.queue.length === 0 ? (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>idle</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 150, overflowY: "auto" }}>
          {arr.queue.map((it, i) => (
            <div key={i} style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "baseline" }} title={it.msg || it.state}>
              <span style={{ color: stateColor(it), flexShrink: 0, width: 38, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {it.pct === null ? "" : `${it.pct}%`}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(255,255,255,0.85)" }}>
                {it.title}
              </span>
              <span style={{ marginLeft: "auto", flexShrink: 0, color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>
                {it.state === "importBlocked" ? "blocked" : it.leftGB > 0 ? `${it.leftGB}G left` : it.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TvPipeline() {
  const [data, setData] = useState<Pipeline | null>(null);
  const [err, setErr] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(LS_KEY) === "1");
    } catch {}
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/tv/pipeline?lines=40", { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        setData(j);
        setErr("");
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "unreachable");
      }
    };
    load();
    const t = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [data?.log?.length, collapsed]);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(LS_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  const active = (data?.radarr.queue?.length ?? 0) + (data?.sonarr.queue?.length ?? 0);

  return (
    <section
      style={{
        marginBottom: 22,
        borderRadius: 14,
        background: "rgba(0,0,0,0.38)",
        border: "1px solid rgba(255,255,255,0.1)",
        overflow: "hidden",
      }}
    >
      <div
        onClick={toggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          cursor: "pointer",
          userSelect: "none",
          fontSize: 13,
        }}
      >
        <span>⚙️</span>
        <span style={{ fontWeight: 700 }}>Pipeline</span>
        <span style={{ color: "rgba(255,255,255,0.45)" }}>
          {err
            ? `⚠️ ${err}`
            : data
              ? `${active} downloading · self-heal last ${fmtTime(data.lastRun ? data.lastRun.replace(" ", "T") + "-05:00" : null)} · next ${fmtTime(data.nextRun)}`
              : "loading…"}
        </span>
        <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{collapsed ? "show ▾" : "hide ▴"}</span>
      </div>

      {!collapsed && data && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            ref={logRef}
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11.5,
              lineHeight: 1.5,
              color: "#a7f3d0",
              background: "rgba(0,0,0,0.45)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10,
              padding: "10px 12px",
              maxHeight: 170,
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {data.log.length === 0 ? (
              <span style={{ color: "rgba(255,255,255,0.35)" }}>tv-unstick.log is empty — first run in progress</span>
            ) : (
              data.log.map((l, i) => (
                <div key={i} style={{ color: /removed\+blocklisted/.test(l) ? "#fbbf24" : undefined }}>
                  {l}
                </div>
              ))
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
            <QueueList label="Movies" arr={data.radarr} />
            <QueueList label="TV" arr={data.sonarr} />
          </div>
        </div>
      )}
    </section>
  );
}
