"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { furnaceBlowerStatus } from "@/lib/heat/accounting";
import type { PlannerEvent } from "@/lib/heat/planner-schema";

type Learned = { id: string; ts: string; param: string; key: string; value: number; n: number; season: string };
type Data = {
  latest: PlannerEvent | null; decisions: PlannerEvent[]; learned: Learned[];
  days: Record<string, unknown>[];
  commands: { id: string; action: string; status: string; createdAt: string }[];
  watchdog: PlannerEvent | null;
  review: PlannerEvent | null;
  blower?: PlannerEvent | null; blowerHistory?: PlannerEvent[];
};
const time = (s: string | undefined) => s ? new Date(s).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
const n = (x: unknown, digits = 1) => typeof x === "number" ? x.toFixed(digits) : "—";
const obj = (x: unknown): Record<string, unknown> => x && typeof x === "object" && !Array.isArray(x) ? x as Record<string, unknown> : {};
function deviceReading(x: unknown) {
  if (x === true) return "On";
  if (x === false) return "Off";
  if (typeof x === "string") return x;
  const v = obj(x);
  const parts = [typeof v.heat_sp === "number" ? `${n(v.heat_sp)}°F` : null, v.mode,
    v.fan ? `fan ${v.fan}` : null, v.calling === true ? "heating" : v.calling === false ? "no heat call" : null];
  return parts.filter(Boolean).join(" · ") || "Unknown / no change";
}
const box = "rounded-2xl border border-white/10 bg-white/[0.04] p-4";
const input = "rounded-lg border border-white/25 bg-slate-950 px-3 py-2 text-base text-white";

export function PlannerPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState("all");
  const [reason, setReason] = useState("all");
  const [learning, setLearning] = useState("");
  const [target, setTarget] = useState(71);
  const [hours, setHours] = useState(2);
  async function refresh() {
    try {
      const r = await fetch("/api/heat/planner", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 401 ? "Unlock Heat to see the planner." : "Planner history is unavailable.");
      setData(await r.json()); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Planner connection failed."); }
  }
  useEffect(() => { void refresh(); const timer = setInterval(refresh, 30_000); return () => clearInterval(timer); }, []);
  async function send(action: string) {
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/heat/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...(["warm", "hold"].includes(action) ? { target_f: target, hours } : action === "stove" ? { hours: Math.min(hours, 8) } : {}) }) });
      const response = await r.json();
      if (!r.ok) throw new Error(response.error || "Request failed");
      setMessage(response.message); await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Request failed"); }
    finally { setBusy(false); }
  }
  const latest = data?.latest;
  const stale = latest ? Date.now() - Date.parse(latest.ts) > 600_000 : false;
  const sensors = obj(latest?.inputs?.sensors);
  const blower = obj(latest?.inputs?.blower);
  const blowerStatus = furnaceBlowerStatus(blower);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const savings = obj(data?.days.find(d => d.date === today)?.savings);
  const costs = obj(savings.costs);
  const supplement = obj(savings.supplement);
  const learned = obj(latest?.inputs?.learned);
  const reasons = [...new Set(data?.decisions.map(d => d.reason_code).filter(Boolean) ?? [])];
  const keys = [...new Set(data?.learned.map(l => `${l.param}|${l.key}`) ?? [])];
  const selected = learning || keys[0];
  const rates = useMemo(() => (data?.learned ?? []).filter(l => `${l.param}|${l.key}` === selected).slice().reverse().map(l => ({ ...l, label: time(l.ts) })), [data, selected]);
  const decisions = (data?.decisions ?? []).filter(d => (reason === "all" || d.reason_code === reason) && (device === "all" || d.device === device || Boolean(d.devices?.[device])));
  const temperatures = (data?.decisions ?? []).filter(d => d.kind === "decision").slice().reverse().map(d => ({
    label: time(d.ts), living: obj(d.inputs?.sensors).living_f, loft: obj(d.inputs?.sensors).loft_f,
    outdoor: obj(d.inputs?.weather).outdoor_f, feels: obj(d.inputs?.weather).feels_f,
  }));
  return <section className="mt-6 space-y-4" aria-label="Crazy Monkey HVAC planner">
    <div className={box}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Crazy Monkey planner</h2>
        <span className={`rounded-full px-3 py-1 text-sm ${latest?.mode === "live" ? "bg-emerald-400/15 text-emerald-200" : "bg-sky-400/15 text-sky-200"}`}>{latest ? `${latest.season} · ${latest.mode}` : "Awaiting planner"}</span>
      </div>
      <p className="mt-2 text-sm text-white/65">{latest?.mode === "live" ? "Spark controls the approved devices. Each action requires readback." : "Shadow plans only. Existing routines and services still control the equipment."}</p>
      {error && <p role="status" className="mt-2 text-amber-200">{error}</p>}
      {stale && <p role="alert" className="mt-2 text-amber-200">Planner report is over ten minutes old. The readings below are historical.</p>}
      {latest ? <>
        <p className="mt-3 leading-relaxed">{latest.why}</p>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-white/55">Living room / target</dt><dd className="mt-1 text-lg">{n(sensors.living_f)}° / {n(latest.plan?.target_f)}°</dd></div>
          <div><dt className="text-white/55">Next warm-up</dt><dd className="mt-1">{time(latest.plan?.warmup_start as string)}</dd></div>
          <div><dt className="text-white/55">Predicted wake temperature</dt><dd className="mt-1 text-lg">{n(latest.plan?.predicted_wake_f)}°</dd></div>
          <div><dt className="text-white/55">Period / escalation</dt><dd>{latest.period} / L{String(latest.plan?.escalation_level ?? "—")}</dd></div>
          <div><dt className="text-white/55">Override</dt><dd>{String(latest.override?.type ?? "none")}</dd></div>
          <div><dt className="text-white/55">Reported</dt><dd>{time(latest.ts)}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-white/55">Forecast assumes the proposed plan runs. Furnace stage is unmeasured. Recovery model has {n(learned.warmup_sample_n, 0)} comparable windows; a small sample does not establish prediction accuracy or the cheapest heating strategy.</p>
        {Boolean(latest.alerts?.length) && <p className="mt-3 text-amber-200">Alerts: {latest.alerts!.join(", ")}</p>}
      </> : <p className="mt-3 text-white/60">No planner decisions have arrived yet.</p>}
    </div>

    <div className={box}>
      <h3 className="text-lg font-semibold">Furnace blower status</h3>
      <p className="mt-2 text-2xl">{blowerStatus}</p>
      <p className="mt-2 text-sm text-white/65">Honeywell reports actual fan-running status. Missing, stopped or older-than-90-second observations block automatic humidification. Furnace electricity is unmeasured.</p>
      <p className="mt-3 text-sm text-amber-200">Device correction: the former power readings belong to the separate Fireplace Blower. They are excluded from furnace runtime and energy accounting. Its nightly cutoff is 1 AM Central.</p>
    </div>

    <div className={box}>
      <h3 className="text-lg font-semibold">Savings with comfort</h3>
      <p className="mt-2 text-sm text-white/70">Keep the occupied-room target, then compare total heating cost and time below that target. Lower runtime in one furnace alone does not prove whole-house savings.</p>
      {Object.keys(costs).length ? <>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-white/55">Upstairs gas today</dt><dd className="mt-1 text-lg">${n(costs.upstairs_gas_usd_low,2)}–${n(costs.upstairs_gas_usd_high,2)}</dd></div>
          <div><dt className="text-white/55">Basement gas today</dt><dd className="mt-1 text-lg">${n(costs.nest_gas_usd,2)}</dd></div>
          <div><dt className="text-white/55">Below occupied target</dt><dd className="mt-1 text-lg">{n(savings.below_target_min,0)} min / {n(savings.comfort_observed_min,0)} observed</dd></div>
        </dl>
        <p className="mt-3 text-sm text-white/65">Gas assumptions: ${n(costs.gas_usd_per_ccf,2)}/CCF; upstairs ${n(costs.upstairs_usd_per_h_low,2)}–${n(costs.upstairs_usd_per_h_high,2)} per burner-hour; basement ${n(costs.nest_usd_per_h,2)} per burner-hour. These are runtime estimates, not measured bills.</p>
        <p className="mt-3 text-sm">Basement boost {n(supplement.boost_f,0)}°F / idle {n(supplement.idle_f,0)}°F is a fixed policy. One basement burner-hour must displace about {n(costs.basement_break_even_upstairs_min_low,0)}–{n(costs.basement_break_even_upstairs_min_high,0)} upstairs burner-minutes to break even on estimated gas alone. That displacement has not been demonstrated.</p>
        <p className="mt-3 text-sm text-white/65">Still needed for a complete savings comparison:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/65">{Array.isArray(costs.missing) && costs.missing.map(x => <li key={String(x)}>{String(x)}</li>)}</ul>
      </> : <p className="mt-3 text-sm text-white/65">Awaiting corrected cost and comfort accounting. No maximum-savings claim can be made from the existing data.</p>}
    </div>

    <div className={box}>
      <h3 className="text-lg font-semibold">Comfort controls</h3>
      <p className="mt-1 text-sm text-white/65">In shadow, these change the proposed plan only. “Accepted” means Spark received the request; the decision timeline shows any actual device results.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">Room target °F<input className={`${input} w-28`} type="number" min={60} max={73} step={0.5} value={target} onChange={e => setTarget(Number(e.target.value))} /></label>
        <label className="flex flex-col gap-1 text-sm">Hours<input className={`${input} w-24`} type="number" min={0.1} max={24} step={0.5} value={hours} onChange={e => setHours(Number(e.target.value))} /></label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{[["warm", "Warm now"], ["hold", "Hold target"], ["auto", "Auto"], ["away", "Away"], ["home", "Home"], ["stove", "Stove mode"]].map(([action, label]) => <button key={action} disabled={busy || !latest || stale} onClick={() => void send(action)} className="rounded-lg border border-white/25 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-40">{label}</button>)}</div>
      <p role="status" className="mt-2 text-sm text-sky-200">{message}</p>
      <ul className="mt-2 space-y-1 text-sm text-white/60">{data?.commands.slice(0, 4).map(c => <li key={c.id}>{time(c.createdAt)} · {c.action} · {c.status.replaceAll("_", " ")}</li>)}</ul>
    </div>

    <div className={box}>
      <h3 className="text-lg font-semibold">Decision timeline</h3>
      <div className="my-3 flex flex-wrap gap-2">
        <label className="text-sm">Device<select className={`${input} ml-2 max-w-full`} value={device} onChange={e => setDevice(e.target.value)}>{["all", "honeywell", "nest", "humidifier", "loft_fan"].map(d => <option key={d}>{d}</option>)}</select></label>
        <label className="min-w-0 text-sm">Reason<select className={`${input} ml-2 max-w-[16rem]`} value={reason} onChange={e => setReason(e.target.value)}><option value="all">all</option>{reasons.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
      </div>
      <div className="max-h-[32rem] space-y-3 overflow-y-auto">
        {decisions.slice(0, 80).map(d => <details key={d.id} className={`rounded-lg border p-3 ${d.result === "failed" || d.alerts?.length ? "border-red-300/40" : "border-white/10"}`}>
          <summary className="cursor-pointer text-sm">{time(d.ts)} · {d.reason_code || d.kind} · {d.mode}</summary>
          <p className="mt-2 text-sm leading-relaxed">{d.why || `${d.device ?? ""} ${d.result ?? ""}`}</p>
          {d.devices && <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="pr-3">Device</th><th className="pr-3">Observed before</th><th>Proposed / result</th></tr></thead><tbody>{Object.entries(d.devices).map(([name, raw]) => { const v = obj(raw); return <tr key={name} className="border-t border-white/10 align-top"><td className="py-2 pr-3">{name.replaceAll("_", " ")}</td><td className="max-w-56 break-words py-2 pr-3">{deviceReading(v.before ?? v.observed)}</td><td className="max-w-56 break-words py-2">{deviceReading(v.after)} · {String(v.write ?? (d.mode === "shadow" ? "shadow" : "observed"))}</td></tr>; })}</tbody></table></div>}
          <p className="mt-2 text-sm text-white/55">{d.readback_ok == null ? "" : `Verified: ${d.readback_ok ? "yes" : "no"}`} {d.error || ""}</p>
        </details>)}
        {!decisions.length && <p className="text-sm text-white/60">No matching decisions yet.</p>}
      </div>
    </div>

    <div className={box}><h3 className="text-lg font-semibold">Planner temperatures</h3><p className="mb-3 text-sm text-white/55">Living room, loft, outdoors and feels-like from the decision inputs.</p><div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={temperatures}><CartesianGrid stroke="#ffffff15" /><XAxis dataKey="label" hide /><YAxis domain={["auto", "auto"]} width={35} /><Tooltip contentStyle={{ background: "#0f172a", borderColor: "#334155" }} /><Line name="Living" dataKey="living" stroke="#fbbf24" dot={false} connectNulls={false} /><Line name="Loft" dataKey="loft" stroke="#fb7185" dot={false} connectNulls={false} /><Line name="Outdoor" dataKey="outdoor" stroke="#38bdf8" dot={false} connectNulls={false} /><Line name="Feels like" dataKey="feels" stroke="#a5b4fc" dot={false} connectNulls={false} /></LineChart></ResponsiveContainer></div></div>

    <div className={box}>
      <h3 className="text-lg font-semibold">Learning history</h3>
      {keys.length ? <><label className="mt-2 block text-sm">Observed rate<select className={`${input} mt-1 w-full`} value={selected} onChange={e => setLearning(e.target.value)}>{keys.map(k => <option key={k}>{k}</option>)}</select></label><div className="mt-3 h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={rates}><CartesianGrid stroke="#ffffff15" /><XAxis dataKey="label" hide /><YAxis domain={["auto", "auto"]} width={35} /><Tooltip contentStyle={{ background: "#0f172a", borderColor: "#334155" }} /><Line dataKey="value" stroke="#34d399" dot /></LineChart></ResponsiveContainer></div><p className="text-sm text-white/60">Latest rate {n(rates.at(-1)?.value, 2)} per hour · {rates.at(-1)?.n ?? 0} valid observation windows.</p></> : <p className="mt-2 text-sm text-white/60">Collecting complete observation windows. No learned rates are being claimed yet.</p>}
    </div>

    <div className={box}>
      <h3 className="text-lg font-semibold">Morning and cost review</h3>
      <p className="mt-1 text-sm text-white/55">Observation windows only; compare similar weather, starting temperatures, occupancy and fire use. Figures below overlap the dashboard totals and must not be added to them.</p>
      {data?.days.map(d => {
        const audit=obj(d.savings), morning=obj(audit.morning);
        return <article key={String(d.date)} className="mt-3 border-t border-white/10 pt-3 text-sm">
          <h4 className="font-semibold">{String(d.date)} · {String(d.season)} · {n(d.coverage_h)} hours observed</h4>
          <p className="mt-2">Wake: {n(audit.wake_actual_f ?? d.wake_actual_f)}° actual / {n(audit.wake_target_f)}° target. {audit.prediction_at ? <>First warm-up prediction: {n(audit.prediction_f)}° at {time(String(audit.prediction_at))} ({n(audit.prediction_lead_min,0)} min ahead).</> : <>No frozen advance forecast; the old rolling prediction is not an accuracy score.</>}</p>
          <p className="mt-1">Below occupied target: {n(audit.below_target_min,0)} minutes in {n(audit.comfort_observed_min,0)} observed minutes. Temperature shortfall: {n(audit.shortfall_degree_h,2)} degree-hours.</p>
          <p className="mt-1">Estimated gas ${n(d.gas_usd_low,2)}–${n(d.gas_usd_high,2)} · humidifiers ${n(d.humid_usd,2)} · water {n(d.humid_water_gal)} gal ({d.humid_water_usd == null ? "water/sewer price missing" : `$${n(d.humid_water_usd,2)}`}).</p>
          {Object.keys(morning).length>0 && <p className="mt-2">Morning {time(String(morning.start))}–{time(String(morning.end))}: {n(morning.observed_h,2)} h observed; upstairs heat {n(morning.upstairs_h,2)} h, basement {n(morning.nest_h,2)} h. Gas ${n(morning.gas_usd_low,2)}–${n(morning.gas_usd_high,2)}; basement portion ${n(morning.nest_gas_usd,2)}. Basement temperature {n(morning.basement_min_f)}–{n(morning.basement_max_f)}°.</p>}
          {d.blower_source === "honeywell_fan_status" && <p className="mt-1 text-white/55">Furnace fan-only coverage begins {time(String(d.blower_coverage_since))}; earlier fireplace power is excluded.</p>}
        </article>;
      })}
      <p className="mt-3 text-sm text-white/60">Watchdog: {data?.watchdog ? `${time(data.watchdog.ts)} · ${data.watchdog.alerts?.length ? data.watchdog.alerts.join(", ") : "no alerts"}` : "awaiting independent check"}</p>
      {data?.review?.text && <details className="mt-3"><summary className="cursor-pointer text-sm">Latest automatic review · {data.review.date}</summary><pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/70">{data.review.text}</pre></details>}
    </div>
  </section>;
}
