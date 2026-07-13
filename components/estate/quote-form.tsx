"use client";

import { useState } from "react";

type FormStatus = "idle" | "submitting" | "success" | "error";

const SITUATIONS = [
  { value: "downsizing", label: "Downsizing" },
  { value: "estate_settlement", label: "Settling an estate" },
  { value: "moving", label: "Moving / relocating" },
  { value: "cleanout_only", label: "Just need it emptied" },
  { value: "other", label: "Something else" },
];

const TIMEFRAMES = [
  { value: "asap", label: "As soon as possible" },
  { value: "this_month", label: "This month" },
  { value: "1_3_months", label: "1–3 months out" },
  { value: "exploring", label: "Just exploring" },
];

export function EstateQuoteForm() {
  const [situation, setSituation] = useState("estate_settlement");
  const [timeframe, setTimeframe] = useState("this_month");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    if (!email.trim() && !phone.trim()) {
      setStatus("error");
      setErrorMsg("Leave a phone number or email so Jared can get back to you.");
      return;
    }
    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/lead/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subsite: "estate",
          action: "request_estate_consult",
          contact: {
            name: name.trim() || undefined,
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
          },
          fields: {
            // manifest declares name as a required action field — send it here
            // as well as in contact (validation reads fields, /hq reads both)
            name: name.trim(),
            situation,
            timeframe,
            city: city.trim() || undefined,
            details: details.trim() || undefined,
            ref:
              new URLSearchParams(window.location.search).get("ref") || undefined,
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(
          (data && typeof data.error === "string" && data.error) ||
            "Something went wrong — try again in a minute, or just call.",
        );
        return;
      }
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
      <div className="es-panel p-8 text-center">
        <p className="es-display text-xl" style={{ color: "var(--es-brass-bright)" }}>
          Got it — Jared reads every one of these.
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--es-cream-dim)" }}>
          Expect a call or text back, usually the same day. The walkthrough is
          free and there&apos;s zero obligation.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="es-panel grid gap-4 p-6 sm:p-8">
      <div>
        <span className="mb-2 block text-sm font-medium">What&apos;s the situation?</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {SITUATIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded border px-3 py-2.5 text-sm transition"
              style={{
                borderColor:
                  situation === opt.value
                    ? "var(--es-brass)"
                    : "rgba(214,188,152,0.2)",
                background:
                  situation === opt.value ? "rgba(201,162,75,0.1)" : "transparent",
              }}
            >
              <input
                type="radio"
                name="estate-situation"
                value={opt.value}
                checked={situation === opt.value}
                onChange={() => setSituation(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="estate-city" className="mb-1.5 block text-sm font-medium">
            Property city
          </label>
          <input
            id="estate-city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Independence, Blue Springs…"
            className="es-input px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="estate-timeframe" className="mb-1.5 block text-sm font-medium">
            Timeframe
          </label>
          <select
            id="estate-timeframe"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="es-input px-3.5 py-2.5 text-sm"
          >
            {TIMEFRAMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          aria-label="Your name"
          required
          className="es-input px-3.5 py-2.5 text-sm"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          autoComplete="tel"
          aria-label="Phone"
          className="es-input px-3.5 py-2.5 text-sm"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          aria-label="Email"
          className="es-input px-3.5 py-2.5 text-sm"
        />
      </div>
      <p className="-mt-2 text-xs" style={{ color: "var(--es-cream-dim)" }}>
        Phone or email — at least one.
      </p>

      <textarea
        rows={3}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Tell us about the home — size, what's in it, anything on your mind. (Optional)"
        aria-label="Details"
        className="es-input resize-y px-3.5 py-2.5 text-sm"
      />

      {status === "error" && (
        <p className="rounded border border-red-800 bg-red-950/40 px-3.5 py-2.5 text-sm text-red-300">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="es-btn-primary px-6 py-3.5 text-base disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Book my free walkthrough"}
      </button>
      <p className="text-center text-xs" style={{ color: "var(--es-cream-dim)" }}>
        Free, no obligation, everything negotiable. You talk directly to Jared —
        not a call center.
      </p>
    </form>
  );
}
