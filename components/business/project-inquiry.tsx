"use client";

import { useRef, useState } from "react";
import { submitLead } from "@/lib/lead-capture-client";
import { browserAttribution } from "@/lib/discovery-browser";
import { trackEvent } from "@/components/analytics/site-tracker";
import { BUSINESS_EMAIL, BUSINESS_WORKFLOWS } from "@/lib/business";
import styles from "@/app/business/business.module.css";

export function BusinessInquiry() {
  const [state, setState] = useState<"idle" | "saving" | "error" | "saved">("idle");
  const [error, setError] = useState("");
  const saving = useRef(false);
  const requestId = useRef<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) || "").trim();
    if (!value("name") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value("email")) || !value("problem")) {
      setError("Add your name, a valid email, and the task you want to improve."); return;
    }
    saving.current = true; setState("saving"); setError("");
    try {
      requestId.current ||= crypto.randomUUID();
      await submitLead("/api/lead/action", {
        requestId: requestId.current, subsite: "business", action: "request_business_project",
        contact: { name: value("name"), email: value("email") },
        fields: Object.fromEntries(["workflow", "problem", "organization", "country", "timeZone", "tools", "frequency", "budget", "timeline"].map(key => [key, value(key)])),
        attribution: browserAttribution(value("source")),
      });
      setState("saved");
      requestAnimationFrame(() => statusRef.current?.focus());
      trackEvent("business", "inquiry_success", "Business software project");
    } catch (e) {
      setState("error"); setError(e instanceof Error ? e.message : "Your request was not saved. Please try again or email Jared.");
    } finally { saving.current = false; }
  }
  if (state === "saved") return <div className={styles.success} ref={statusRef} tabIndex={-1} role="status">
    <p className={styles.eyebrow}>INQUIRY SAVED</p><h3>Let’s understand the work.</h3>
    <p>Jared will review your workflow and follow up at the email you provided. We’ll discuss the fit, scope, and next step together.</p>
    <p>This is an inquiry, not a booked project or a payment.</p><a href={`mailto:${BUSINESS_EMAIL}`}>{BUSINESS_EMAIL}</a>
  </div>;
  return <form className={styles.form} onSubmit={submit} method="post" aria-label="Business software project inquiry">
    <fieldset><legend>What keeps landing on your to-do list?</legend>
      <label>Workflow<select name="workflow" defaultValue="paperwork">{BUSINESS_WORKFLOWS.map(w => <option value={w.id} key={w.id}>{w.title}</option>)}<option value="other">Something else</option></select></label>
      <label>The task you want to improve <span>(required)</span><textarea name="problem" required maxLength={4000} rows={4} placeholder="We get delivery photos by text, then retype everything into invoices. I’d like to review a draft instead."/></label>
      <label>Current tools <span>(optional)</span><input name="tools" maxLength={500} placeholder="Spreadsheets, accounting software, email, storefront…"/></label>
      <label>How often does this happen? <span>(optional)</span><input name="frequency" maxLength={300} placeholder="e.g. 30 jobs a week, about 4 hours of admin"/></label>
    </fieldset>
    <fieldset><legend>A little about you</legend><div className={styles.fields}>
      <label>Your name <span>(required)</span><input name="name" required autoComplete="name" maxLength={120}/></label>
      <label>Email <span>(required)</span><input name="email" type="email" required autoComplete="email" maxLength={200}/></label>
      <label>Country <span>(optional)</span><input name="country" autoComplete="country-name" maxLength={120} placeholder="Anywhere in the world"/></label>
      <label>Time zone or city <span>(optional)</span><input name="timeZone" maxLength={120} placeholder="e.g. London / GMT"/></label>
    </div><label>Business name &amp; what you do <span>(optional)</span><input name="organization" autoComplete="organization" maxLength={200}/></label></fieldset>
    <details className={styles.optional}><summary>Budget, timing &amp; how you found me <span>(optional)</span></summary><div className={styles.fields}>
      <label>Budget &amp; currency<input name="budget" maxLength={160} placeholder="A range or ‘help me scope it’"/></label>
      <label>Ideal timing<input name="timeline" maxLength={160} placeholder="When would this be useful?"/></label>
    </div><label>How did you find me?<input name="source" maxLength={300} placeholder="A referral, Google, ChatGPT…"/></label></details>
    {error && <p className={styles.error} role="alert">{error} You can also <a href={`mailto:${BUSINESS_EMAIL}`}>email Jared</a>.</p>}
    <button className={styles.button} disabled={state === "saving"}>{state === "saving" ? "Saving your inquiry…" : "Tell Jared about the work"}</button>
    <p className={styles.small}>You’re asking Jared to contact you about this project. No payment or commitment. Please leave out passwords and private customer records. <a href="/privacy">Privacy policy</a>.</p>
    <noscript><style>{`.${styles.form} fieldset,.${styles.form}>details,.${styles.form}>button{display:none}`}</style><p>Email <a href={`mailto:${BUSINESS_EMAIL}`}>{BUSINESS_EMAIL}</a> with your workflow, current tools, and country or time zone.</p></noscript>
  </form>;
}
