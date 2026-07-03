"use client";

import { useState, useMemo, useEffect } from "react";

interface OpenHouseEvent {
  id: string;
  address: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
  marketing: string[];
  status: "planned" | "active" | "completed";
}

interface Visitor {
  id: string;
  eventId: string;
  name: string;
  phone: string;
  email: string;
  hasAgent: boolean;
  preApproved: boolean;
  budget: string;
  timeline: string;
  convertedToLead: boolean;
}

interface OHData { events: OpenHouseEvent[]; visitors: Visitor[]; }

const CHANNELS = ["MLS", "Zillow", "Facebook", "Instagram", "Signs", "Flyers"];
const BUDGETS = ["Under $200k", "$200-300k", "$300-400k", "$400-500k", "$500k+"];
const TIMELINES = ["ASAP", "1-3 months", "3-6 months", "Just looking"];

export default function OpenHouseManager() {
  const [tab, setTab] = useState<"upcoming" | "signin" | "past" | "stats">("upcoming");
  const [data, setData] = useState<OHData>({ events: [], visitors: [] });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ address: "", date: "", startTime: "13:00", endTime: "15:00", notes: "", marketing: ["MLS", "Signs"] as string[] });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [vf, setVf] = useState({ name: "", phone: "", email: "", hasAgent: false, preApproved: false, budget: "$200-300k", timeline: "1-3 months" });

  useEffect(() => { try { const s = localStorage.getItem("t-agent-open-houses"); if (s) setData(JSON.parse(s)); } catch {} }, []);
  useEffect(() => { localStorage.setItem("t-agent-open-houses", JSON.stringify(data)); }, [data]);

  const activeEvents = data.events.filter((e) => e.status === "active");
  const upcomingEvents = data.events.filter((e) => e.status === "planned");
  const pastEvents = data.events.filter((e) => e.status === "completed");
  const selVisitors = data.visitors.filter((v) => v.eventId === selectedEventId);

  const stats = useMemo(() => {
    const tv = data.visitors.length;
    const conv = data.visitors.filter((v) => v.convertedToLead).length;
    const te = data.events.length;
    const budgets: Record<string, number> = {};
    for (const v of data.visitors) budgets[v.budget] = (budgets[v.budget] || 0) + 1;
    return { te, tv, avg: te > 0 ? Math.round(tv / te) : 0, conv, rate: tv > 0 ? Math.round((conv / tv) * 100) : 0, budgets };
  }, [data]);

  function addEvent() {
    if (!form.address || !form.date) return;
    setData({ ...data, events: [...data.events, { ...form, id: crypto.randomUUID(), status: "planned" }] });
    setForm({ address: "", date: "", startTime: "13:00", endTime: "15:00", notes: "", marketing: ["MLS", "Signs"] });
    setShowForm(false);
  }

  function addVisitor() {
    if (!vf.name || !vf.phone || !selectedEventId) return;
    setData({ ...data, visitors: [...data.visitors, { ...vf, id: crypto.randomUUID(), eventId: selectedEventId, convertedToLead: false }] });
    setVf({ name: "", phone: "", email: "", hasAgent: false, preApproved: false, budget: "$200-300k", timeline: "1-3 months" });
  }

  const TABS = [{ id: "upcoming" as const, label: "Upcoming" }, { id: "signin" as const, label: "Sign-In Sheet" }, { id: "past" as const, label: "Past" }, { id: "stats" as const, label: "Stats" }];

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-white/10 pb-1">
        {TABS.map((t) => (<button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === t.id ? "border-blue-400 text-blue-300 font-medium" : "border-transparent text-white/40 hover:text-white/60"}`}>{t.label}</button>))}
      </div>

      {tab === "upcoming" && (
        <div className="space-y-4">
          <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-blue-600/20 text-blue-300 px-4 py-2 text-sm hover:bg-blue-600/30">{showForm ? "Cancel" : "+ Schedule Open House"}</button>
          {showForm && (
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="col-span-2 md:col-span-3"><label className="text-xs text-white/40 block mb-1">Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none" placeholder="123 Main St" /></div>
              <div><label className="text-xs text-white/40 block mb-1">Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white [color-scheme:dark] focus:outline-none" /></div>
              <div><label className="text-xs text-white/40 block mb-1">Start</label><input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white [color-scheme:dark] focus:outline-none" /></div>
              <div><label className="text-xs text-white/40 block mb-1">End</label><input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white [color-scheme:dark] focus:outline-none" /></div>
              <div className="col-span-2 md:col-span-3"><label className="text-xs text-white/40 block mb-1">Marketing</label><div className="flex flex-wrap gap-2">{CHANNELS.map((c) => (<label key={c} className="flex items-center gap-1.5 text-xs text-white/60"><input type="checkbox" checked={form.marketing.includes(c)} onChange={(e) => setForm({ ...form, marketing: e.target.checked ? [...form.marketing, c] : form.marketing.filter((m) => m !== c) })} />{c}</label>))}</div></div>
              <div className="flex items-end"><button onClick={addEvent} className="w-full rounded-lg bg-emerald-600/20 text-emerald-300 px-4 py-2 text-sm hover:bg-emerald-600/30">Save</button></div>
            </div>
          )}
          {[...activeEvents, ...upcomingEvents].length === 0 ? (<div className="text-center py-12 text-white/30">No open houses scheduled</div>) : (
            <div className="space-y-3">{[...activeEvents, ...upcomingEvents].map((e) => (
              <div key={e.id} className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2"><span className="text-white font-medium">{e.address}</span><span className={`text-[10px] px-2 py-0.5 rounded-full ${e.status === "active" ? "bg-emerald-500/20 text-emerald-300" : "bg-blue-500/20 text-blue-300"}`}>{e.status === "active" ? "LIVE" : "Planned"}</span></div>
                  <div className="text-xs text-white/40 mt-1">{e.date} | {e.startTime} - {e.endTime}</div>
                  <div className="flex gap-1 mt-1">{e.marketing.map((m) => <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40">{m}</span>)}</div>
                </div>
                <div className="flex gap-2">
                  {e.status === "planned" && <button onClick={() => { setData({ ...data, events: data.events.map((x) => x.id === e.id ? { ...x, status: "active" } : x) }); setSelectedEventId(e.id); setTab("signin"); }} className="text-xs text-emerald-400 hover:text-emerald-300">Start</button>}
                  {e.status === "active" && <button onClick={() => setData({ ...data, events: data.events.map((x) => x.id === e.id ? { ...x, status: "completed" } : x) })} className="text-xs text-yellow-400 hover:text-yellow-300">End</button>}
                </div>
              </div>
            ))}</div>
          )}
        </div>
      )}

      {tab === "signin" && (
        <div className="space-y-4">
          <select value={selectedEventId || ""} onChange={(e) => setSelectedEventId(e.target.value || null)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white [color-scheme:dark] focus:outline-none">
            <option value="">Select open house...</option>
            {[...activeEvents, ...upcomingEvents].map((e) => (<option key={e.id} value={e.id}>{e.address} — {e.date}</option>))}
          </select>
          {selectedEventId ? (
            <>
              <div className="text-xs text-white/40">{selVisitors.length} visitor{selVisitors.length !== 1 ? "s" : ""}</div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className="text-xs text-white/40 block mb-1">Name *</label><input value={vf.name} onChange={(e) => setVf({ ...vf, name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none" /></div>
                <div><label className="text-xs text-white/40 block mb-1">Phone *</label><input value={vf.phone} onChange={(e) => setVf({ ...vf, phone: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none" /></div>
                <div><label className="text-xs text-white/40 block mb-1">Email</label><input value={vf.email} onChange={(e) => setVf({ ...vf, email: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none" /></div>
                <div><label className="text-xs text-white/40 block mb-1">Has Agent?</label><div className="flex gap-3 mt-1"><label className="text-xs text-white/60"><input type="radio" checked={!vf.hasAgent} onChange={() => setVf({ ...vf, hasAgent: false })} /> No</label><label className="text-xs text-white/60"><input type="radio" checked={vf.hasAgent} onChange={() => setVf({ ...vf, hasAgent: true })} /> Yes</label></div></div>
                <div><label className="text-xs text-white/40 block mb-1">Pre-approved?</label><div className="flex gap-3 mt-1"><label className="text-xs text-white/60"><input type="radio" checked={!vf.preApproved} onChange={() => setVf({ ...vf, preApproved: false })} /> No</label><label className="text-xs text-white/60"><input type="radio" checked={vf.preApproved} onChange={() => setVf({ ...vf, preApproved: true })} /> Yes</label></div></div>
                <div><label className="text-xs text-white/40 block mb-1">Budget</label><select value={vf.budget} onChange={(e) => setVf({ ...vf, budget: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white [color-scheme:dark] focus:outline-none">{BUDGETS.map((b) => <option key={b}>{b}</option>)}</select></div>
                <div><label className="text-xs text-white/40 block mb-1">Timeline</label><select value={vf.timeline} onChange={(e) => setVf({ ...vf, timeline: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white [color-scheme:dark] focus:outline-none">{TIMELINES.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div className="flex items-end"><button onClick={addVisitor} className="w-full rounded-lg bg-emerald-600/20 text-emerald-300 px-4 py-1.5 text-sm hover:bg-emerald-600/30">Sign In</button></div>
              </div>
              {selVisitors.length > 0 && (
                <div className="rounded-xl border border-white/10 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-white/5 text-white/40 text-xs"><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Phone</th><th className="px-3 py-2">Agent?</th><th className="px-3 py-2">Pre-Appr?</th><th className="px-3 py-2 text-left">Budget</th><th className="px-3 py-2 text-left">Timeline</th><th className="px-3 py-2"></th></tr></thead>
                    <tbody className="divide-y divide-white/5">{selVisitors.map((v) => (
                      <tr key={v.id}>
                        <td className="px-3 py-2 text-white">{v.name}</td>
                        <td className="px-3 py-2 text-white/60">{v.phone}</td>
                        <td className="px-3 py-2 text-center">{v.hasAgent ? <span className="text-yellow-300 text-xs">Yes</span> : <span className="text-emerald-300 text-xs">No</span>}</td>
                        <td className="px-3 py-2 text-center">{v.preApproved ? <span className="text-emerald-300 text-xs">Yes</span> : <span className="text-white/30 text-xs">No</span>}</td>
                        <td className="px-3 py-2 text-white/60">{v.budget}</td>
                        <td className="px-3 py-2 text-white/60">{v.timeline}</td>
                        <td className="px-3 py-2">{v.convertedToLead ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Lead</span> : <button onClick={() => setData({ ...data, visitors: data.visitors.map((x) => x.id === v.id ? { ...x, convertedToLead: true } : x) })} className="text-[10px] text-blue-400 hover:text-blue-300">Convert</button>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </>
          ) : <div className="text-center py-8 text-white/30">Select an open house to manage sign-ins</div>}
        </div>
      )}

      {tab === "past" && (
        pastEvents.length === 0 ? <div className="text-center py-12 text-white/30">No completed open houses yet</div> : (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-white/5 text-white/40 text-xs"><th className="px-4 py-2 text-left">Address</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Visitors</th><th className="px-4 py-2">Converted</th></tr></thead>
              <tbody className="divide-y divide-white/5">{pastEvents.map((e) => { const ev = data.visitors.filter((v) => v.eventId === e.id); return (
                <tr key={e.id}><td className="px-4 py-3 text-white">{e.address}</td><td className="px-4 py-3 text-white/60 text-center">{e.date}</td><td className="px-4 py-3 text-center text-white/60">{ev.length}</td><td className="px-4 py-3 text-center text-emerald-300">{ev.filter((v) => v.convertedToLead).length}</td></tr>
              ); })}</tbody>
            </table>
          </div>
        )
      )}

      {tab === "stats" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[{ l: "Events", v: stats.te }, { l: "Visitors", v: stats.tv }, { l: "Avg/Event", v: stats.avg }, { l: "Converted", v: stats.conv }, { l: "Conv Rate", v: `${stats.rate}%` }].map((s) => (
              <div key={s.l} className="rounded-xl bg-white/5 border border-white/10 p-4 text-center"><div className="text-2xl font-bold text-white">{s.v}</div><div className="text-xs text-white/40">{s.l}</div></div>
            ))}
          </div>
          {Object.keys(stats.budgets).length > 0 && (
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <h3 className="text-sm font-medium text-white/60 mb-3">Visitors by Budget</h3>
              {Object.entries(stats.budgets).sort().map(([b, c]) => (<div key={b} className="flex justify-between text-sm py-1"><span className="text-white/60">{b}</span><span className="text-white">{c}</span></div>))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
