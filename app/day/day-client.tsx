"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DAY_ZONE, SECTION_IDS, SECTION_LABELS, isStale, stub, type DayView } from "@/lib/day/core";

export function DayPinGate() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function unlock(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/shop/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
      if (!response.ok) { setError(response.status === 429 ? "Too many attempts. Please try again in 15 minutes." : "PIN not accepted. Please try again."); return; }
      setPin(""); router.refresh();
    } catch { setError("Could not connect. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  return <main className="day-shell day-gate">
    <form onSubmit={unlock} className="day-unlock">
      <span className="day-wordmark">TOLLEY / DAY</span>
      <div className="day-sun" aria-hidden="true">☀</div>
      <h1>A clear start.</h1>
      <p>Your money, opportunities and plans in one quiet place.</p>
      <label htmlFor="day-pin">Family PIN <span>Same as TV &amp; Food</span></label>
      <input id="day-pin" type="password" inputMode="numeric" autoComplete="one-time-code" required value={pin} onChange={e => setPin(e.target.value)} />
      <button disabled={busy}>{busy ? "Unlocking…" : "Open my day →"}</button>
      {error && <p role="alert" className="day-error">{error}</p>}
      <small>Private briefing · America/Chicago</small>
    </form>
  </main>;
}

export function DayDashboard({ initial, preview }: { initial: DayView; preview: boolean }) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const router = useRouter();
  // Re-read durable cache on focus / each minute; this never pulls paid APIs.
  useEffect(() => {
    const controller = new AbortController();
    async function sync() {
      setNow(new Date());
      try {
        const r = await fetch("/api/day", { cache: "no-store", signal: controller.signal });
        if (r.status === 401) { router.refresh(); return; }
        if (r.ok) setView(await r.json());
      } catch { /* Keep last rendered snapshot and its timestamp while offline. */ }
    }
    setNow(new Date()); setCanFullscreen(Boolean(document.fullscreenEnabled));
    const interval = setInterval(() => { if (!document.hidden) void sync(); }, 60_000);
    const focus = () => { if (!document.hidden) void sync(); };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [router]);

  async function refresh() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/day", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (response.status === 401) { router.refresh(); return; }
      if (!response.ok) {
        setMessage(response.status === 429 ? "A refresh just ran. Try again in 30 seconds." : "Refresh failed. Your saved snapshot is still shown."); return;
      }
      const next = await response.json() as DayView;
      setView(next); setNow(new Date());
      setMessage(next.storage === "ready" ? "Snapshot refreshed and saved. Check each source’s status below." : "Live pull finished, but could not be saved. These results may disappear on reload.");
    } catch { setMessage("Could not connect. Your last snapshot is still shown."); }
    finally { setBusy(false); }
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setMessage("Full screen is unavailable. On iPhone, use Share → Add to Home Screen."); }
  }
  const snapshot = view.snapshot;
  const live = snapshot ? SECTION_IDS.filter(id => snapshot.sections[id].status === "live").length : 0;
  const date = now ?? (snapshot ? new Date(snapshot.generatedAt) : null);
  const stale = Boolean(snapshot && now && isStale(snapshot, now));
  return <main className="day-shell">
    <div className="day-container">
      <header className="day-header">
        <div><div className="day-wordmark">TOLLEY / DAY <span>PRIVATE BRIEFING</span></div>
          <h1>Your day, at a glance<span className="day-dot">.</span></h1>
          <p>{date ? date.toLocaleDateString("en-US", { timeZone: DAY_ZONE, weekday: "long", month: "long", day: "numeric" }) : "Daily briefing"} <span className="day-separator">/</span> Central time</p>
        </div>
        <div className="day-actions">
          {canFullscreen && <button className="day-secondary" onClick={fullscreen}>Full screen</button>}
          <button onClick={refresh} disabled={busy}>{busy ? "Pulling sources…" : "↻ Refresh"}</button>
        </div>
      </header>
      <div className="day-status" aria-live="polite">
        <span className={`day-status-dot ${stale || !snapshot ? "day-warn" : ""}`} />
        <span>{snapshot ? `${stale ? "Stale snapshot · " : "Snapshot · "}${new Date(snapshot.generatedAt).toLocaleString("en-US", { timeZone: DAY_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} CT` : "No saved snapshot yet · tap Refresh to begin"}</span>
        <span className="day-source-count">{live} live / {SECTION_IDS.length - live} stub</span>
      </div>
      {view.storage === "unavailable" && <p role="alert" className="day-banner">Snapshot storage is unavailable. A live pull cannot be confirmed as saved.</p>}
      {stale && <p className="day-banner">These totals belong to the snapshot date. Refresh for today’s numbers.</p>}
      <p className="day-feedback" role="status">{message}</p>
      <section className="day-grid" aria-label="Daily sources" aria-busy={busy}>
        {SECTION_IDS.map((id, index) => {
          const section = snapshot?.sections[id] ?? stub("Waiting for first refresh", "No snapshot yet. Refresh to check this source.");
          return <article key={id} className={`day-card day-card-${id}`}>
            <div className="day-card-top"><span className="day-number">0{index + 1}</span><span className={`day-badge day-badge-${section.status}`}>{section.status}</span></div>
            <h2>{SECTION_LABELS[id]}</h2>
            {section.status === "live" ? <dl className="day-metrics">{section.metrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl> : <div className="day-empty">Numbers unavailable<span>stub · see source note below</span></div>}
            {section.items.length > 0 && <ul className="day-items">{section.items.map((item, i) => <li key={i}>{item}</li>)}</ul>}
            <p className="day-note">{section.note}</p><p className="day-source">{section.source}</p>
          </article>;
        })}
      </section>
      <footer className="day-footer"><span>Scheduled refresh · 6 AM Central<br />Read-only sources · saved in the cloud</span><a href="/day/summary.txt">Three-line Siri summary ↗</a><span>iPhone: Share → Add to Home Screen<br />{preview ? "Preview · scheduled cron is inactive" : "PIN required on each new browser"}</span></footer>
    </div>
  </main>;
}
