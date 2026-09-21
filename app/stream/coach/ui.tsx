"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import "./coach.css";

type Show = { id: string; title: string; started: number; ended: number | null; sources: Record<string, string> };
type Event = { id: string; t: number; platform: string; name: string; message: string; kind: string; category?: string; amount?: string };
type Sale = { id: string; t: number; platform: string; item: string; buyer: string; cents: number; quantity: number };
type Answer = { id: string; question: string; answer: string; status: string };
type Snapshot = {
  sessions: Show[]; activeId: string | null; show: Show | null;
  collector: { at: number | null; error: string; youtube: { connected?: boolean; video?: string }; tiktok: { connected?: boolean; user?: string; viewers?: number } };
  metrics?: { messages: number; observedNames: number; gifts: number; openQuestions: number; salesCents: number; orders: number; units: number; aovCents: number | null; messagesPerMinute: number; previousMessagesPerMinute: number; durationSeconds: number };
  questions?: Event[]; events?: Event[]; sales?: Sale[]; answers?: Answer[];
  demand?: { topic: string; count: number; open: number }[];
  audience?: { name: string; platform: string; messages: number; gifts: number }[];
  hints?: { title: string; text: string; reason: string }[];
  recap?: string[]; historyTruncated?: boolean;
};
const platform: Record<string, string> = { yt: "YouTube", tt: "TikTok", youtube: "YouTube", tiktok: "TikTok", whatnot: "Whatnot", ebay: "eBay", other: "Other" };
const money = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
const when = (t: number) => new Date(t * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function Coach() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [tab, setTab] = useState("live");
  const [finish, setFinish] = useState(false);
  const [sale, setSale] = useState({ item: "", buyer: "", price: "", quantity: "1", platform: "whatnot" });
  const saleId = useRef("");
  const revision = useRef(0);
  const [now, setNow] = useState(() => Date.now() / 1000);
  const load = useCallback(async () => {
    const version = ++revision.current;
    try {
      const response = await fetch(`/api/stream-coach/snapshot${selected ? `?sessionId=${encodeURIComponent(selected)}` : ""}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.detail || "Could not load Stream Coach.");
      if (version === revision.current) { setData(result); setLoadError(""); setNow(Date.now() / 1000); }
    } catch (e) { if (version === revision.current) setLoadError(e instanceof Error ? e.message : "Connection lost."); }
  }, [selected]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { setNow(Date.now() / 1000); if (!document.hidden) void load(); }, 4000);
    // This is a request generation counter, not a DOM ref. Invalidate in-flight loads on cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { window.clearInterval(timer); revision.current++; };
  }, [load]);
  async function command(action: string, fields: Record<string, unknown> = {}, endpoint = "action") {
    if (busy) return null;
    setBusy(action); setError("");
    try {
      const response = await fetch(`/api/stream-coach/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, sessionId: data?.show?.id, ...fields }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.detail || "Could not save.");
      await load();
      return result;
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); return null; }
    finally { setBusy(""); }
  }
  function changeShow(id: string) { revision.current++; setSelected(id); setData(null); setFinish(false); setError(""); saleId.current = ""; }
  const show = data?.show;
  const tracking = !!show && !show.ended;
  const stale = !!loadError || !!data?.collector.error || !data?.collector.at || now - data.collector.at > 15;
  const yt = !stale && !!data?.collector.youtube.connected;
  const tt = !stale && !!data?.collector.tiktok.connected;
  const ytMismatch = !!show?.sources?.yt && data?.collector.youtube.video !== show.sources.yt;
  const ttMismatch = !!show?.sources?.tt && data?.collector.tiktok.user !== show.sources.tt;
  const metrics = data?.metrics;
  const pending = data?.answers?.some(a => a.status === "pending");

  function download() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `tolley-show-${show?.id || "records"}.json`; link.click(); URL.revokeObjectURL(url);
  }

  return <main className="sc">
    <div className="sc-top"><Link href="/stream">← Stream controls</Link><Link href="/stream/growth">Schedule & profit ↗</Link></div>
    <header className="sc-header"><div><p className="sc-eyebrow">TOLLEY / YOUR PRIVATE COHOST</p><h1>Stream Coach<span>✦</span></h1><p>Keep the conversation moving. Catch the questions. Learn from every show.</p></div><span className={`sc-status ${tracking && !stale ? "on" : ""}`}><i />{tracking ? stale ? "Connection interrupted" : "Tracking your show" : "Ready when you are"}</span></header>
    {(loadError || error) && <div className="sc-error" role="alert">{error || loadError} <button onClick={() => void load()}>Retry connection</button></div>}
    <div className="sc-connections" aria-label="Data connections"><span className={yt ? "connected" : ""}>● YouTube {yt ? "connected" : "offline"}</span><span className={tt ? "connected" : ""}>● TikTok {tt ? "connected" : "offline"}</span><span>○ Whatnot · sales entry only</span><span>Private guidance · no automatic chat replies</span></div>
    <section className="sc-session">
      <div><label htmlFor="sc-show">Your shows</label><select id="sc-show" value={selected} onChange={e => changeShow(e.target.value)}><option value="">{data?.activeId ? "Current show" : "Latest show"}</option>{data?.sessions.map(s => <option key={s.id} value={s.id}>{s.title} · {when(s.started)}{!s.ended ? " · tracking" : ""}</option>)}</select></div>
      {!data?.activeId ? <form onSubmit={async e => { e.preventDefault(); const r = await command("start", { title }); if (r) { setTitle(""); changeShow(r.id); } }}><label htmlFor="sc-title">Track a new show</label><div className="sc-inline"><input id="sc-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Tonight’s treasure haul" required /><button className="sc-primary" disabled={!!busy || !data}>Start tracking</button></div></form> : <div className="sc-track-note">Chat is saved while tracking, even with this page closed. Tracking does not start or stop your broadcast.</div>}
    </section>
    {!data && !loadError && <p role="status" className="sc-empty">Connecting to your coach…</p>}
    {data && !show && <section className="sc-welcome"><span>✦</span><h2>Your next show has a cohost.</h2><p>Give your show a name and start tracking. Connected YouTube and TikTok chat becomes a question board and a saved show recap.</p><p>Add Whatnot sales as they happen. Your original stream controls stay one tap away.</p></section>}
    {show && metrics && <>
      <div className="sc-show-heading"><div><h2>{show.title}</h2><p>{when(show.started)} · {show.ended ? "Saved show" : `${Math.floor(metrics.durationSeconds / 60)} minutes tracked`}</p></div><div className="sc-actions"><button onClick={download}>Export snapshot</button>{tracking && <button onClick={() => setFinish(true)}>Finish tracking</button>}</div></div>
      {finish && <div className="sc-confirm"><p>Finish saving chat for this show? Your broadcast will keep running.</p><button disabled={!!busy} onClick={async () => { if (await command("end")) setFinish(false); }}>Finish this show’s tracking</button><button onClick={() => setFinish(false)}>Keep tracking</button></div>}
      {tracking && (ytMismatch || ttMismatch) && <p className="sc-warning">The chat source changed. Capture for the changed platform is paused for this show. Start a new tracking session to follow a different source.</p>}
      {data.historyTruncated && <p className="sc-warning">This overview covers the most recent 20,000 captured events. Older records remain saved.</p>}
      <div className="sc-metrics"><Metric label="Recorded gross sales" value={money(metrics.salesCents)} detail={`${metrics.orders} manual sales · USD`} /><Metric label="Questions to review" value={String(metrics.openQuestions)} detail="Mark handled after answering" /><Metric label="Captured messages" value={String(metrics.messages)} detail={`${metrics.observedNames} observed display names`} /><Metric label="Average recorded sale" value={metrics.aovCents === null ? "—" : money(metrics.aovCents)} detail={`${metrics.units} units entered · before costs`} /></div>
      <nav className="sc-tabs" aria-label="Coach views">{[["live","Show board"],["sales","Sales"],["audience","Audience"],["recap","Recap & ask"]].map(([id,label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav>
      {tab === "live" && <div className="sc-grid"><div className="sc-stack"><section className="sc-card sc-next"><p className="sc-eyebrow">YOUR NEXT MOVE</p>{data.hints?.map((h,i) => <div key={i}><h3>{h.title}</h3><p>{h.text}</p><small>{h.reason}</small></div>)}</section><section className="sc-card"><div className="sc-card-title"><h3>Buyer questions</h3><span>{metrics.openQuestions} to review</span></div><p className="sc-caption">Flagged from chat. Spoken answers aren’t detected.</p>{!data.questions?.length && <p className="sc-empty">No unhandled questions in captured chat yet.</p>}{data.questions?.map(q => <article className="sc-question" key={q.id}><div><span className="sc-pill">{q.category}</span><small>{platform[q.platform]} · {when(q.t)}</small></div><strong>{q.name}</strong><p>{q.message}</p><button disabled={!!busy} onClick={() => void command("resolve", { id: q.id, resolved: true })}>✓ Handled</button></article>)}</section></div><div className="sc-stack"><section className="sc-card"><h3>What people are asking</h3>{data.demand?.map(d => <div className="sc-demand" key={d.topic}><span>{d.topic}</span><b>{d.count}</b><div style={{ width: `${Math.max(0, Math.min(100,d.count / Math.max(1, ...data.demand!.map(x => x.count)) * 100))}%` }} /></div>)}</section><section className="sc-card"><div className="sc-card-title"><h3>Captured chat</h3><span>{tracking && !stale ? `${metrics.messagesPerMinute}/min` : "Saved events"}</span></div><div className="sc-feed">{!data.events?.length && <p className="sc-empty">Messages will appear when a connected chat is active.</p>}{data.events?.map(e => <div key={e.id}><small>{platform[e.platform]} · {when(e.t)}</small><p><strong>{e.name}</strong> {e.message} {e.kind === "gift" && e.amount ? `(${e.amount})` : ""}</p></div>)}</div></section></div></div>}
      {tab === "sales" && <div className="sc-grid"><section className="sc-card"><h3>Record a sale</h3><p className="sc-caption">Enter the actual total paid for the item(s), before fees. Gifts and chat messages never count as sales.</p><form className="sc-form" onSubmit={async e => { e.preventDefault(); if (!saleId.current) saleId.current = crypto.randomUUID(); const r = await command("sale", { id: saleId.current, item: sale.item, buyer: sale.buyer, platform: sale.platform, cents: Math.round(Number(sale.price) * 100), quantity: Number(sale.quantity) }); if (r) { saleId.current = ""; setSale({ ...sale, item: "", buyer: "", price: "", quantity: "1" }); } }}>
        <label>Platform<select value={sale.platform} onChange={e => { saleId.current=""; setSale({ ...sale, platform:e.target.value }); }}>{["whatnot","youtube","tiktok","ebay","other"].map(p => <option key={p} value={p}>{platform[p]}</option>)}</select></label>
        <label>Item<input value={sale.item} onChange={e => { saleId.current=""; setSale({ ...sale, item:e.target.value }); }} maxLength={160} required placeholder="Hair dryer set" /></label>
        <div className="sc-two"><label>Total USD<input type="number" min="0.01" max="1000000" step="0.01" value={sale.price} onChange={e => { saleId.current=""; setSale({ ...sale, price:e.target.value }); }} required placeholder="12.00" /></label><label>Quantity<input type="number" min="1" max="10000" step="1" value={sale.quantity} onChange={e => { saleId.current=""; setSale({ ...sale, quantity:e.target.value }); }} required /></label></div>
        <label>Buyer handle <small>(optional)</small><input value={sale.buyer} onChange={e => { saleId.current=""; setSale({ ...sale, buyer:e.target.value }); }} maxLength={80} placeholder="Platform handle" /></label><button className="sc-primary" disabled={!!busy}>Save sale</button></form></section><section className="sc-card"><h3>Recorded sales</h3><p className="sc-caption">Manual entries · gross sales, not profit. Correct mistakes by removing an entry and adding it again.</p>{!data.sales?.length && <p className="sc-empty">No sales entered for this show.</p>}{data.sales?.map(s => <article className="sc-sale" key={s.id}><div><strong>{s.item}</strong><small>{platform[s.platform]} · {s.quantity} unit(s){s.buyer ? ` · ${s.buyer}` : ""}</small></div><b>{money(s.cents)}</b><button aria-label={`Remove sale ${s.item}`} disabled={!!busy} onClick={() => void command("void-sale", { id: s.id })}>Remove</button></article>)}</section></div>}
      {tab === "audience" && <section className="sc-card"><h3>The people in your captured chat</h3><p className="sc-caption">These are platform/display-name pairs, not verified identities or total viewers. Silent viewers aren’t counted. Gift activity is separate from purchases.</p><div className="sc-audience">{!data.audience?.length && <p className="sc-empty">Your audience board fills as chat arrives.</p>}{data.audience?.map(a => <div key={`${a.platform}:${a.name}`}><span className="sc-avatar">{a.name.slice(0,1).toUpperCase()}</span><div><strong>{a.name}</strong><small>{platform[a.platform]}</small></div><span>{a.messages} messages<br/><small>{a.gifts} gift events</small></span></div>)}</div></section>}
      {tab === "recap" && <div className="sc-grid"><section className="sc-card"><p className="sc-eyebrow">{tracking ? "SHOW SO FAR" : "SAVED SHOW RECAP"}</p><h3>What your records say</h3><ul className="sc-recap">{data.recap?.map(r => <li key={r}>{r}</li>)}</ul><p className="sc-caption">Whatnot chat, competitor activity and platform sales feeds aren’t connected. Missing data stays unknown.</p><Link className="sc-text-link" href="/stream/growth">Reconcile costs and profit →</Link></section><section className="sc-card"><h3>Ask your coach</h3><p className="sc-caption">Private AI suggestions based on this show’s saved chat and sales. Check advice before acting.</p><div className="sc-prompts">{["Which buyer questions should I answer next?","Give me three improvements for my next show.","Summarize this show and what is still unknown."].map(q => <button key={q} onClick={() => setQuestion(q)}>{q}</button>)}</div><form onSubmit={async e => { e.preventDefault(); if (await command("ask", { question }, "ask")) setQuestion(""); }} className="sc-form"><label htmlFor="sc-question">Ask about this show</label><textarea id="sc-question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={600} required rows={3} placeholder="What should I focus on next?" /><button className="sc-primary" disabled={!!busy || pending}>{pending ? "Coach is thinking…" : "Ask coach"}</button></form><div aria-live="polite">{data.answers?.map(a => <article className="sc-answer" key={a.id}><strong>{a.question}</strong><p>{a.status === "pending" ? "Reading your show records…" : a.answer}</p></article>)}</div></section></div>}
    </>}
    <footer className="sc-footer">Built for your show. Captures connected chat only while tracking. Sales are entered by you. <Link href="/stream">Back to stream controls ↗</Link></footer>
  </main>;
}
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <section className="sc-metric"><p>{label}</p><strong>{value}</strong><small>{detail}</small></section>; }
