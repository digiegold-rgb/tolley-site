"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DAILY_TIME_ZONE, phoneHref, taskReason, type DailyDeskData, type DailyOutcome, type DailyTask } from "@/lib/leads/daily-plan";

const button = "rounded-lg bg-teal-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50";
const input = "mt-1 w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-sm text-white";
async function save(body: Record<string, unknown>) {
  const response = await fetch("/api/leads/daily", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Could not save. Try again.");
  return result;
}
function tomorrowLocal() {
  const date = new Date(); date.setDate(date.getDate()+1); date.setHours(10,0,0,0);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}T10:00`;
}

function FollowUpCard({ task, index, now, onSaved }: { task: DailyTask; index: number; now: Date; onSaved: (message: string) => void }) {
  const [outcome,setOutcome] = useState<DailyOutcome>("conversation");
  const [note,setNote] = useState("");
  const [nextAt,setNextAt] = useState(tomorrowLocal);
  const [nextTitle,setNextTitle] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [requestId,setRequestId] = useState<string | null>(null);
  const phone = phoneHref(task.phone);
  async function record(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const id = requestId || crypto.randomUUID(); setRequestId(id);
    try {
      await save({ action: "outcome", requestId: id, taskId: task.id, outcome, note, ...(outcome === "completed" ? {} : { nextAt: new Date(nextAt).toISOString(), nextTitle: nextTitle.trim() || undefined }) });
      setRequestId(null);
      onSaved(outcome === "snooze" ? "Follow-up rescheduled." : outcome === "completed" ? "Finished and saved." : "Result saved. Your next follow-up is scheduled.");
    } catch(e) { setError(e instanceof Error ? e.message : "Could not save"); }
    finally { setBusy(false); }
  }
  return <article className="rounded-2xl border border-white/15 bg-white/[0.04] p-5" data-testid="daily-task">
    <div className="flex items-start gap-3"><span className="rounded-full bg-teal-300/10 px-3 py-1 text-teal-200">{index+1}</span><div className="min-w-0"><h3 className="text-lg font-semibold">{task.title}</h3><p className="mt-1 text-sm text-amber-200">{taskReason(task,now)}</p></div></div>
    {task.person && <p className="mt-4 font-medium">{task.person}</p>}
    {task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-white/65">{task.description}</p>}
    <div className="mt-4 flex flex-wrap gap-4 text-sm">
      {phone && <a href={phone} className="font-semibold text-teal-200 underline">Call {task.phone}</a>}
      {task.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(task.email) && <a href={`mailto:${encodeURIComponent(task.email)}`} className="font-semibold text-teal-200 underline">Write email</a>}
      {task.href && <Link href={task.href} className="text-white/65 underline">Contact details</Link>}
      {!phone && !task.email && <span className="text-amber-200">No saved phone or email. Add contact details before reaching out.</span>}
    </div>
    <details className="mt-5 border-t border-white/10 pt-4"><summary className="cursor-pointer text-sm font-semibold text-teal-200">Record what happened</summary>
      <form onSubmit={record} className="mt-4 space-y-3">
        <label className="block text-sm">Result<select value={outcome} onChange={e=>setOutcome(e.target.value as DailyOutcome)} className={input}>
          <option value="attempted">Tried, no conversation</option><option value="conversation">Had a conversation</option><option value="appointment">Booked an appointment</option><option value="completed">Finished — no follow-up needed</option><option value="snooze">Do this later</option>
        </select></label>
        <label className="block text-sm">What should you remember?<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={2000} rows={2} className={input} placeholder="Their timing, what they need, or what you promised" /></label>
        {outcome !== "completed" && <><label className="block text-sm">Next step<input value={nextTitle} onChange={e=>setNextTitle(e.target.value)} maxLength={200} className={input} placeholder="e.g. Confirm the walkthrough" /></label><label className="block text-sm">Follow up at (your device’s local time)<input type="datetime-local" required value={nextAt} onChange={e=>setNextAt(e.target.value)} className={input} /></label></>}
        <button disabled={busy} className={button}>{busy ? "Saving…" : "Save result"}</button>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      </form>
    </details>
  </article>;
}

function CaptureForm({ onSaved }: { onSaved: (message: string) => void }) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [requestId,setRequestId] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const fields = new FormData(form);
    const id = requestId || crypto.randomUUID(); setRequestId(id); setBusy(true); setError("");
    try {
      await save({ action: "capture", requestId: id, name: fields.get("name"), phone: fields.get("phone"), email: fields.get("email"), title: fields.get("title") });
      form.reset(); setRequestId(null); onSaved("Person and follow-up saved to Today.");
    } catch(e) { setError(e instanceof Error ? e.message : "Could not save"); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-4 space-y-3">
    <label className="block text-sm">Person or business<input name="name" required maxLength={150} autoComplete="name" className={input} placeholder="Someone you already know or who asked for help" /></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Phone<input name="phone" type="tel" maxLength={40} autoComplete="tel" className={input} /></label><label className="block text-sm">Email<input name="email" type="email" autoComplete="email" className={input} /></label></div>
    <label className="block text-sm">What do you need to do?<input name="title" required maxLength={200} className={input} placeholder="e.g. Book an estate-sale walkthrough" /></label>
    <button disabled={busy} className={button}>{busy ? "Saving…" : "Save person & follow-up"}</button>
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
  </form>;
}

export default function DailyDesk({ data, owner }: { data: DailyDeskData; owner: boolean }) {
  const router = useRouter();
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState<string | null>(null);
  const [showAll,setShowAll] = useState(false);
  const handled = data.progress.attempts + data.progress.conversations + data.progress.appointments + data.progress.completed;
  const visible = showAll ? data.tasks : handled >= 3 ? [] : data.tasks.slice(0,3-handled);
  function onSaved(text: string) { setMessage(text); router.refresh(); }
  async function add(action: string, id: string) {
    setBusy(id); setError("");
    try { await save({ action, ...(action === "add-client" ? { clientId: id } : { inquiryId: id }) }); onSaved("Added to your follow-ups."); }
    catch(e) { setError(e instanceof Error ? e.message : "Could not add follow-up"); }
    finally { setBusy(null); }
  }
  return <div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-teal-200">T-Agent · Today</p><h1 className="mt-1 text-3xl font-semibold">Three follow-ups. A clear next step.</h1><p className="mt-2 max-w-2xl text-sm text-white/65">Start with people who already know you or asked for help. Handle the next promise, record the result, and get back to your day.</p></div><nav aria-label="Today help and tools" className="flex flex-wrap gap-4 text-sm"><Link href="/leads/guide" className="text-teal-200 underline">First-week guide</Link><Link href="/leads/overview" className="text-white/65 underline">Research & tools</Link></nav></header>
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Your logged activity today">
      {[['Follow-ups handled',handled],['Attempts, no conversation',data.progress.attempts],['Conversations',data.progress.conversations],['Appointments booked',data.progress.appointments]].map(([label,value])=><div key={label} className="rounded-xl border border-white/10 p-4"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-white/55">{label}</p></div>)}
    </section>
    <p className="text-xs text-white/45">Counts reflect the results you log here. Today uses {DAILY_TIME_ZONE}; appointments are shown separately from conversations.</p>
    {message && <p role="status" className="rounded-xl border border-teal-300/20 p-3 text-sm text-teal-200">{message}</p>}
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <section className="space-y-4"><h2 className="text-xl font-semibold">Your next moves</h2>
        {handled >= 3 && !showAll && <div className="rounded-2xl border border-teal-300/20 p-6"><h3 className="font-semibold text-teal-200">Your three are handled.</h3><p className="mt-2 text-sm text-white/65">{data.pendingCount ? `${data.pendingCount} follow-ups are still due or undated. Review any time-sensitive promises before stopping.` : "Your next follow-ups are saved. You can get back to your day."}</p></div>}
        {visible.map((task,i)=><FollowUpCard key={task.id} task={task} index={i} now={new Date(data.asOf)} onSaved={onSaved} />)}
        {!data.tasks.length && <div className="rounded-2xl border border-dashed border-white/20 p-6"><h3 className="font-semibold">{data.upcoming.length ? "Nothing else is due today." : "Start with one real person."}</h3><p className="mt-2 text-sm text-white/65">{data.upcoming.length ? "Your next scheduled commitments are below." : "Add someone who needs a quote, a walkthrough, a referral, or a check-in. You don’t need an MLS import to start."}</p></div>}
        {data.tasks.length > visible.length && <button onClick={()=>setShowAll(true)} className="text-sm text-teal-200 underline">See more follow-ups ({data.pendingCount} due or undated)</button>}
        {data.pendingCount > 50 && <Link href="/leads/pipeline" className="block text-sm text-white/60 underline">Showing the first 50. Open all tasks in Pipeline.</Link>}
        {data.upcoming.length > 0 && <div className="rounded-xl border border-white/10 p-4"><h3 className="font-semibold">Coming up</h3><ul className="mt-2 space-y-2 text-sm text-white/65">{data.upcoming.map(t=><li key={t.id}>{new Intl.DateTimeFormat('en-US',{timeZone:DAILY_TIME_ZONE,month:'short',day:'numeric'}).format(new Date(t.dueDate!))} · {t.title}</li>)}</ul></div>}
      </section>
      <aside className="space-y-5"><section id="capture" className="scroll-mt-24 rounded-2xl border border-white/15 p-5"><h2 className="text-lg font-semibold">Get it out of your head</h2><p className="mt-1 text-sm text-white/55">Save the person and the promise together.</p><CaptureForm onSaved={onSaved} /></section>
        {owner && <section className="rounded-2xl border border-white/15 p-5"><h2 className="font-semibold">Requests from your sites</h2><p className="mt-1 text-xs text-white/55">New requests from the last 30 days. Only your owner account sees these.</p>{data.inquiries.map(i=><div key={i.id} className="mt-4 border-t border-white/10 pt-3"><p className="text-sm">{i.name} · {i.subsite}</p><p className="mt-1 text-xs text-white/55">Requested: {i.action} · {new Intl.DateTimeFormat("en-US", {timeZone: DAILY_TIME_ZONE, month: "short", day: "numeric"}).format(new Date(i.createdAt))}</p><button onClick={()=>add('adopt-inquiry',i.id)} disabled={busy!==null} className={`${button} mt-2`}>Add follow-up</button></div>)}{!data.inquiries.length && <p className="mt-3 text-sm text-white/55">No new requests to add.</p>}<Link href="/hq?tab=inbound" className="mt-4 block text-sm text-teal-200 underline">Review requests in HQ</Link></section>}
        {data.suggestions.length > 0 && <section className="rounded-2xl border border-white/15 p-5"><h2 className="font-semibold">People already in your contacts</h2><p className="mt-1 text-xs text-white/55">No pending task or logged activity in the last seven calendar days. Choose who merits a check-in.</p>{data.suggestions.map(c=><div key={c.id} className="mt-3 flex items-center justify-between gap-3"><span className="text-sm">{c.name}</span><button onClick={()=>add('add-client',c.id)} disabled={busy!==null} className="text-sm text-teal-200 underline">Add follow-up</button></div>)}</section>}
      </aside>
    </div>
    <section id="week-review" className="scroll-mt-24 rounded-2xl border border-white/10 p-5"><h2 className="font-semibold">Did this help this week?</h2><p className="mt-2 text-sm text-white/65">You logged {data.week.conversations} conversations and {data.week.appointments} appointments in the last seven calendar days. Look for work you would otherwise have forgotten or delayed.</p><div className="mt-4 flex flex-wrap gap-5 text-sm"><Link href="/leads/clients" className="text-teal-200 underline">Contacts</Link><Link href="/leads/deals" className="text-teal-200 underline">Deals & recorded revenue</Link><Link href="/leads/dashboard" className="text-teal-200 underline">Listing research & CSV import</Link></div></section>
  </div>;
}
