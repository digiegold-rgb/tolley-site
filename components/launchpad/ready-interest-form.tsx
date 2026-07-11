"use client";

import { useEffect, useState } from "react";
import {
  LP_READY_BUSINESSES,
  LP_READY_ROLE_OPTIONS,
  LP_OWN_IDEA_KEY,
  LP_PHONE,
  LP_PHONE_SMS,
} from "@/lib/sales";

type FormStatus = "idle" | "submitting" | "success" | "error";

const BUSINESS_KEYS = new Set([
  ...LP_READY_BUSINESSES.map((b) => b.key),
  LP_OWN_IDEA_KEY,
]);

export function ReadyInterestForm() {
  const [role, setRole] = useState<string>("run_business");
  const [business, setBusiness] = useState<string>(LP_READY_BUSINESSES[0].key);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);

  // Preselect from ?ready=<key> deep links and from card CTA clicks.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("ready");
    if (fromUrl && BUSINESS_KEYS.has(fromUrl)) setBusiness(fromUrl);

    function onSelect(e: Event) {
      const key = (e as CustomEvent<{ key?: string }>).detail?.key;
      if (key && BUSINESS_KEYS.has(key)) setBusiness(key);
    }
    window.addEventListener("lp:ready-select", onSelect);
    return () => window.removeEventListener("lp:ready-select", onSelect);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;

    if (!phone.trim() && !email.trim()) {
      setStatus("error");
      setErrorMsg("Leave a phone number or an email so I can reach you back.");
      return;
    }

    setStatus("submitting");
    setErrorMsg("");

    const body = {
      subsite: "sales",
      action: "ready_business_interest",
      contact: {
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      },
      fields: {
        role,
        business,
        notes: notes.trim() || undefined,
      },
    };

    try {
      const res = await fetch("/api/lead/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(
          (data && typeof data.error === "string" && data.error) ||
            `Something went wrong. Text me instead — ${LP_PHONE}.`,
        );
        return;
      }
      setReceipt(data?.receiptToken ?? null);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        `Couldn't reach the server (${err instanceof Error ? err.message : "network error"}). ` +
          `Text me instead — ${LP_PHONE}.`,
      );
    }
  }

  if (status === "success") {
    return (
      <div className="lp-ticket-wrap">
        <div className="lp-ticket p-8 text-center sm:p-10">
          <span className="lp-marker text-2xl">claim&apos;s in.</span>
          <p className="mt-3 text-base leading-relaxed">
            I read every one of these myself. I&apos;ll call or text you back, usually
            within a day, and we&apos;ll talk through the takeover.
          </p>
          {receipt ? (
            <p className="lp-ticket-num mt-4 text-xs opacity-60">Ref: {receipt}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="lp-ticket-wrap">
      <div className="lp-ticket">
        <div className="lp-ticket-perf" aria-hidden="true" />
        <form onSubmit={handleSubmit} className="p-6 sm:p-9">
          <div className="lp-ticket-head flex items-center justify-between pb-4">
            <span className="lp-display text-xl sm:text-2xl">Claim Ticket</span>
            <span className="lp-ticket-num text-xs">No. 002 · Ready-to-Run</span>
          </div>

          <div className="mt-6">
            <span className="lp-field-label mb-2 block">What are you here for?</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {LP_READY_ROLE_OPTIONS.map((opt) => (
                <label key={opt.value} className="lp-check flex items-center gap-2 px-3 py-2.5 text-sm">
                  <input
                    type="radio"
                    name="lp-ready-role"
                    value={opt.value}
                    checked={role === opt.value}
                    onChange={() => setRole(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="lp-ready-biz" className="lp-field-label mb-1.5 block">
              Which business?
            </label>
            <select
              id="lp-ready-biz"
              value={business}
              onChange={(e) => setBusiness(e.target.value)}
              className="lp-input px-3.5 py-2.5 text-sm"
            >
              {LP_READY_BUSINESSES.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.name} — {b.statusLabel}
                </option>
              ))}
              <option value={LP_OWN_IDEA_KEY}>Bring my own idea</option>
            </select>
            {business === LP_OWN_IDEA_KEY ? (
              <p className="mt-2 text-xs leading-relaxed opacity-70">
                Best path for your own idea: the full{" "}
                <a href="#intake" className="underline underline-offset-2 text-[color:var(--lp-rust)]">
                  Work Order below
                </a>{" "}
                — it builds your site on the spot. Or send this and I&apos;ll call you.
              </p>
            ) : null}
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <div>
              <label htmlFor="lp-ready-name" className="lp-field-label mb-1.5 block">
                Your name
              </label>
              <input
                id="lp-ready-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First name's fine"
                autoComplete="name"
                className="lp-input px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="lp-ready-phone" className="lp-field-label mb-1.5 block">
                Phone
              </label>
              <input
                id="lp-ready-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(816) 555-0123"
                autoComplete="tel"
                className="lp-input px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="lp-ready-email" className="lp-field-label mb-1.5 block">
                Email
              </label>
              <input
                id="lp-ready-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="lp-input px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>
          <p className="lp-mono mt-2 text-[0.65rem] opacity-50">
            Phone or email — at least one, so I can reach you.
          </p>

          <div className="mt-5">
            <label htmlFor="lp-ready-notes" className="lp-field-label mb-1.5 block">
              Anything I should know?
            </label>
            <textarea
              id="lp-ready-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Availability, experience, questions — e.g. I drive a truck weekends and know pools."
              className="lp-input resize-y px-3.5 py-2.5 text-sm"
            />
          </div>

          {status === "error" && (
            <p className="mt-5 rounded border border-red-800/50 bg-red-100/40 px-3.5 py-2.5 text-sm text-red-900">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="lp-ticket-submit mt-6 w-full px-6 py-3.5 text-base font-bold"
          >
            {status === "submitting" ? "Sending…" : "Put My Name On It"}
          </button>

          <p className="lp-mono mt-4 text-center text-[0.7rem] opacity-50">
            Reviewed by hand, not a bot. Fastest reply:{" "}
            <a href={LP_PHONE_SMS} className="underline underline-offset-2">
              text {LP_PHONE}
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
