"use client";

import { useState } from "react";

type FormStatus = "idle" | "submitting" | "success" | "error";

const INTENTS = [
  { value: "curious_value", label: "What's my home worth?" },
  { value: "selling", label: "Thinking about selling" },
  { value: "buying", label: "Looking to buy" },
  { value: "investing", label: "Investing in KC" },
];

const TIMELINES = [
  { value: "asap", label: "ASAP" },
  { value: "30_days", label: "Within 30 days" },
  { value: "90_days", label: "Within 90 days" },
  { value: "exploring", label: "Just exploring" },
];

export function AskJaredForm() {
  const [intent, setIntent] = useState("curious_value");
  const [timeline, setTimeline] = useState("exploring");
  const [zip, setZip] = useState("");
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    if (!email.trim() && !phone.trim()) {
      setStatus("error");
      setErrorMsg("Leave an email or phone number so Jared can get back to you.");
      return;
    }
    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/lead/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subsite: "housing",
          action: "ask_about_my_home",
          contact: {
            name: name.trim() || undefined,
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
          },
          fields: {
            intent,
            timeline,
            zip: zip.trim() || undefined,
            address: address.trim() || undefined,
            notes: notes.trim() || undefined,
            // traffic-source attribution (?ref=pinterest / ?ref=circle) — shows
            // in /hq lead details; extra fields pass manifest validation
            ref:
              new URLSearchParams(window.location.search).get("ref") ||
              undefined,
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(
          (data && typeof data.error === "string" && data.error) ||
            "Something went wrong — try again in a minute.",
        );
        return;
      }
      setReceipt(data?.receiptToken ?? null);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        `Couldn't reach the server (${err instanceof Error ? err.message : "network error"}).`,
      );
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-950/40">
        <p className="text-lg font-semibold">Got it — Jared reads every one of these.</p>
        <p className="mt-2 text-sm opacity-80">
          Expect a call or text back, usually the same day.
        </p>
        {receipt ? <p className="mt-3 text-xs opacity-50">Ref: {receipt}</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div>
        <span className="mb-2 block text-sm font-medium">What can Jared help with?</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {INTENTS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${
                intent === opt.value
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              <input
                type="radio"
                name="housing-intent"
                value={opt.value}
                checked={intent === opt.value}
                onChange={() => setIntent(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="housing-zip" className="mb-1.5 block text-sm font-medium">
            Property ZIP
          </label>
          <input
            id="housing-zip"
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
            placeholder="64052"
            className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="housing-timeline" className="mb-1.5 block text-sm font-medium">
            Timeline
          </label>
          <select
            id="housing-timeline"
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {TIMELINES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="housing-address" className="mb-1.5 block text-sm font-medium">
          Address <span className="opacity-50">(optional — for a sharper answer)</span>
        </label>
        <input
          id="housing-address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="123 Main St, Independence, MO"
          autoComplete="street-address"
          className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          aria-label="Your name"
          className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          aria-label="Email"
          className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          autoComplete="tel"
          aria-label="Phone"
          className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <p className="-mt-2 text-xs opacity-50">Email or phone — at least one.</p>

      <textarea
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Anything else? (condition, situation, questions)"
        aria-label="Notes"
        className="w-full resize-y rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />

      {status === "error" && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="rounded-lg bg-blue-600 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Ask Jared"}
      </button>
      <p className="text-center text-xs opacity-50">
        Free, no obligation. Answered by a licensed local agent — not a call center.
      </p>
    </form>
  );
}
