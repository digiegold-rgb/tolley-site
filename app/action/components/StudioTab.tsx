"use client";

// Studio tab (v2) — editing styles, on-demand builds (monthly / reels / events),
// and holiday-event management. All endpoints are the action-api's new v2 surface.

import { useCallback, useEffect, useState } from "react";
import { S } from "../styles";

type StyleMap = Record<string, Record<string, unknown>>;
type EventItem = {
  slug: string; name: string; start: string; end: string;
  style?: string; builtin?: boolean; built?: boolean; empty?: boolean;
};

const STYLE_BLURB: Record<string, string> = {
  classic: "The original cut — chronological, crossfades, random music. What the nightly builds use.",
  cinematic: "Story arc: cold-open hook → build → slow-mo climax on the music peak → warm close. Cuts on downbeats, end card.",
  hype: "Fast beat-synced cuts, energy first. Short and punchy — great for a big day.",
  story: "Narrated chapters with title cards and a gentle pace. Made for holidays and trips.",
  chill: "Long holds, soft fades, easy pace. Sunday-morning vibes.",
};

export function StudioTab({ apiBase, token, onJob }: {
  apiBase: string;
  token: string;
  onJob: (jobId: string, meta: { period: string; kind: string; label: string }) => void;
}) {
  const [styles, setStyles] = useState<StyleMap>({});
  const [defaultStyle, setDefaultStyle] = useState("classic");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [evName, setEvName] = useState("");
  const [evStart, setEvStart] = useState("");
  const [evEnd, setEvEnd] = useState("");

  const authHeaders = { "Content-Type": "application/json", "x-action-token": token };

  const load = useCallback(async () => {
    try {
      const [sr, er] = await Promise.all([
        fetch(`${apiBase}/styles`, { cache: "no-store" }),
        fetch(`${apiBase}/events`, { cache: "no-store" }),
      ]);
      const sj = await sr.json();
      setStyles(sj.styles || {});
      setDefaultStyle(sj.default || "classic");
      const ej = await er.json();
      setEvents(ej.events || []);
    } catch (e: any) {
      setErr(`Studio load failed: ${e.message}`);
    }
  }, [apiBase]);

  useEffect(() => { load(); }, [load]);

  async function post(path: string, body: Record<string, unknown>, label: string,
                      meta?: { period: string; kind: string }) {
    setErr("");
    setBusy(label);
    try {
      const r = await fetch(`${apiBase}${path}`, {
        method: "POST", headers: authHeaders, body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      if (j.jobId) onJob(j.jobId, { period: meta?.period || "", kind: meta?.kind || "build", label });
      else await load();
    } catch (e: any) {
      setErr(`${label} failed: ${e.message}`);
    } finally {
      setBusy("");
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={S.tabIntro}>
        <b>🎬 Studio</b> — the AI editing controls. Pick a <b>style</b> when re-editing any recap (on its card),
        build <b>monthly recaps</b> and <b>highlight reels</b> on demand, and manage <b>holiday recaps</b> —
        they also build automatically the night after each holiday.
      </div>

      {err && <div style={{ color: "#f87171", marginBottom: 10 }}>{err}</div>}

      {/* Styles reference */}
      <h3 style={{ margin: "18px 0 8px" }}>Editing styles</h3>
      <div style={S.grid}>
        {Object.keys(styles).map((name) => (
          <div key={name} style={S.card}>
            <div style={S.cardHead}>
              <span style={S.badge(name === defaultStyle)}>{name}{name === defaultStyle ? " · default" : ""}</span>
            </div>
            <div style={{ padding: "4px 2px 8px", color: "#cbd5e1", fontSize: 13, lineHeight: 1.5 }}>
              {STYLE_BLURB[name] || "Custom style."}
              <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
                {["arc", "beat_sync", "slowmo", "endcard"].map((k) => (
                  <span key={k} style={{ marginRight: 10 }}>
                    {k}: <b>{String((styles[name] as any)?.[k])}</b>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* On-demand builds */}
      <h3 style={{ margin: "22px 0 8px" }}>Build now</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          style={{ ...S.titleInput, maxWidth: 170 } as any} />
        <button style={S.dayBtn} disabled={!!busy}
          onClick={() => post("/regenerate", { kind: "monthly", period: month },
            `Monthly recap ${month}`, { period: month, kind: "monthly" })}>
          📆 Monthly recap
        </button>
        <button style={S.dayBtn} disabled={!!busy}
          onClick={() => post("/regenerate", { kind: "monthlyreel", period: month },
            `Monthly highlights ${month}`, { period: month, kind: "monthlyreel" })}>
          ⚡ Monthly highlights (90s)
        </button>
        <button style={S.dayBtn} disabled={!!busy}
          onClick={() => post("/reel", { kind: "splashes" }, "Best Splashes reel", { period: "splashes", kind: "reel" })}>
          💦 Splashes reel
        </button>
        <button style={S.dayBtn} disabled={!!busy}
          onClick={() => post("/reel", { kind: "critters" }, "Critters reel", { period: "critters", kind: "reel" })}>
          🐿️ Critters reel
        </button>
        <button style={S.dayBtn} disabled={!!busy}
          onClick={() => post("/reel", { kind: "season" }, "Season supercut", { period: "season", kind: "reel" })}>
          ☀️ Season supercut
        </button>
        <button style={S.dayBtn} disabled={!!busy}
          onClick={() => post("/events/build", {}, "Event recap sweep", { period: "events", kind: "event" })}>
          🎉 Build due holiday recaps
        </button>
      </div>

      {/* Events */}
      <h3 style={{ margin: "22px 0 8px" }}>Holidays & events</h3>
      <div style={{ ...S.tabIntro, marginBottom: 10 }}>
        US holidays are pre-loaded. Add birthdays / vacations below — the night after an event's
        window closes, a themed recap builds from that window's footage automatically.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <input placeholder="Event name (e.g. Emma's Birthday)" value={evName}
          onChange={(e) => setEvName(e.target.value)} style={{ ...S.titleInput, maxWidth: 260 } as any} />
        <input type="date" value={evStart} onChange={(e) => setEvStart(e.target.value)}
          style={{ ...S.titleInput, maxWidth: 160 } as any} />
        <span style={{ color: "#64748b" }}>to</span>
        <input type="date" value={evEnd || evStart} onChange={(e) => setEvEnd(e.target.value)}
          style={{ ...S.titleInput, maxWidth: 160 } as any} />
        <button style={S.dayBtn} disabled={!evName || !evStart || !!busy}
          onClick={() => {
            post("/events/add", { name: evName, start: evStart, end: evEnd || evStart }, "Add event");
            setEvName(""); setEvStart(""); setEvEnd("");
          }}>
          ＋ Add event
        </button>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {events.map((ev) => (
          <div key={ev.slug} style={{
            display: "flex", gap: 10, alignItems: "center", padding: "8px 12px",
            background: "#0f172a", borderRadius: 10, border: "1px solid #1e293b",
          }}>
            <span style={{ minWidth: 20 }}>{ev.built ? (ev.empty ? "⬜" : "✅") : "🕒"}</span>
            <span style={{ flex: 1, color: "#e2e8f0" }}>{ev.name}</span>
            <span style={{ color: "#64748b", fontSize: 12 }}>
              {ev.start}{ev.end !== ev.start ? ` → ${ev.end}` : ""}
            </span>
            {!ev.builtin && (
              <button style={S.smallBtn} title="Delete this event"
                onClick={() => post("/events/delete", { slug: ev.slug }, "Delete event")}>🗑</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
