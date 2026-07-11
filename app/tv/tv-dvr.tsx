"use client";

import { useCallback, useEffect, useState } from "react";

type Airing = {
  guid: string;
  title: string;
  episodeTitle?: string;
  channel?: string;
  begins?: string;
  thumb?: string;
};
type Recording = { id: string; title: string };
type RecentItem = { title: string; watch: string };

const box: React.CSSProperties = {
  display: "flex",
  gap: 12,
  padding: 12,
  borderRadius: 14,
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.1)",
  alignItems: "center",
};
const btn = (primary = false): React.CSSProperties => ({
  padding: primary ? "12px 18px" : "8px 14px",
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: primary ? 16 : 13,
  background: primary ? "#f59e0b" : "rgba(245,158,11,0.15)",
  color: primary ? "#000" : "#f59e0b",
});

// Live TV & DVR tab — natural-language recording via the DGX tv-api proxy.
export function TvDvr() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [candidate, setCandidate] = useState<Airing | null>(null);
  const [alternatives, setAlternatives] = useState<Airing[]>([]);
  const [message, setMessage] = useState("");
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const r = await fetch(`/api/tv/${path}`, init);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  }, []);

  const loadRecordings = useCallback(() => {
    api("recordings")
      .then((j) => {
        setRecordings(j.subscriptions || []);
        setRecent(j.recentlyAdded || []);
      })
      .catch(() => {});
  }, [api]);

  useEffect(loadRecordings, [loadRecordings]);

  async function findAiring(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setMessage("");
    setCandidate(null);
    setAlternatives([]);
    try {
      const j = await api("record", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, confirm: false }),
      });
      setCandidate(j.wouldRecord);
      setAlternatives(j.alternatives || []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRecord(target: Airing) {
    setBusy(true);
    setMessage("");
    try {
      const j = await api("record", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guid: target.guid, title: target.title }),
      });
      setMessage(
        `✅ Scheduled: ${j.recorded?.title ?? target.title}${
          j.recorded?.begins ? ` — ${j.recorded.begins}` : ""
        }. Watch it in Plex when it's done.`,
      );
      setCandidate(null);
      setAlternatives([]);
      setQuery("");
      loadRecordings();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function cancelRecording(id: string) {
    await api(`recordings/${id}`, { method: "DELETE" }).catch(() => {});
    loadRecordings();
  }

  const AiringRow = ({ a, small }: { a: Airing; small?: boolean }) => (
    <div style={box}>
      {a.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.thumb}
          alt=""
          style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
        />
      ) : (
        <div style={{ fontSize: 26 }}>📺</div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {a.title}
        </div>
        {a.episodeTitle && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{a.episodeTitle}</div>
        )}
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)" }}>
          {a.begins}
          {a.channel ? ` · ${a.channel}` : ""}
        </div>
      </div>
      <button onClick={() => confirmRecord(a)} disabled={busy} style={btn(!small)}>
        ⏺ Record
      </button>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <form onSubmit={findAiring} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={2}
          placeholder={'Say what to record — "record Deadly Women tonight" (tap the 🎙 mic on your phone keyboard and speak)'}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 14,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "white",
            fontSize: 16,
            outline: "none",
            resize: "none",
          }}
        />
        <button type="submit" disabled={busy || !query.trim()} style={{ ...btn(true), opacity: busy || !query.trim() ? 0.5 : 1 }}>
          {busy ? "Searching the guide…" : "🔎 Find it in the guide"}
        </button>
      </form>

      {message && (
        <div style={{ ...box, fontSize: 13.5 }}>
          <span>{message}</span>
        </div>
      )}

      {candidate && (
        <>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Best match:</div>
          <AiringRow a={candidate} />
          {alternatives.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Other airings:</div>
              {alternatives.slice(0, 5).map((a) => (
                <AiringRow key={a.guid + (a.begins || "")} a={a} small />
              ))}
            </>
          )}
        </>
      )}

      {recordings.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
            Scheduled recordings
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recordings.map((r) => (
              <div key={r.id} style={{ ...box, justifyContent: "space-between" }}>
                <span style={{ fontSize: 13.5 }}>{r.title}</span>
                <button
                  onClick={() => cancelRecording(r.id)}
                  style={{ ...btn(), background: "rgba(239,68,68,0.15)", color: "#f87171" }}
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
            Recently added to Plex — tap to watch
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recent.slice(0, 10).map((r) => (
              <a key={r.watch} href={r.watch} target="_blank" rel="noreferrer" style={{ ...box, textDecoration: "none", color: "white", fontSize: 13.5 }}>
                ▶ {r.title}
              </a>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
        600+ live channels play in the Plex app → Live TV. Recordings land in your Plex libraries.
      </div>
    </div>
  );
}
