"use client";

import { useMemo, useState } from "react";
import { ES_PHONE, ES_PHONE_TEL } from "@/lib/estate";

type Status = "idle" | "submitting" | "success" | "error";

const WINDOWS = [
  { value: "morning", label: "Morning", hint: "8–12" },
  { value: "afternoon", label: "Afternoon", hint: "12–4" },
  { value: "evening", label: "Evening", hint: "4–7" },
];

/** Next 14 days. Today included — same-day is the whole pitch. */
function nextDays(n: number) {
  const out: { iso: string; dow: string; day: string; mon: string }[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    out.push({
      iso: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`,
      dow: i === 0 ? "Today" : x.toLocaleDateString("en-US", { weekday: "short" }),
      day: String(x.getDate()),
      mon: x.toLocaleDateString("en-US", { month: "short" }),
    });
  }
  return out;
}

/**
 * Books a walkthrough instead of collecting a "we'll get back to you" form.
 * Families comparing companies book whoever can come out first, so the date
 * picker is the pitch — it makes same-week availability visible before they
 * have to ask. Rides the existing request_estate_consult lead action; the
 * chosen slot travels in `fields` and lands in /hq with the lead.
 */
export function WalkthroughBooking() {
  const days = useMemo(() => nextDays(14), []);
  const [day, setDay] = useState(days[0].iso);
  const [win, setWin] = useState("afternoon");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    if (!name.trim()) {
      setStatus("error");
      setErr("Just need a name so Jared knows who he's calling.");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setStatus("error");
      setErr("Leave a phone number or an email so we can confirm the time.");
      return;
    }
    setStatus("submitting");
    setErr("");

    const chosen = days.find((d) => d.iso === day);
    const label = chosen ? `${chosen.dow} ${chosen.mon} ${chosen.day}` : day;
    const windowLabel = WINDOWS.find((w) => w.value === win);

    try {
      const res = await fetch("/api/lead/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subsite: "estate",
          action: "request_estate_consult",
          contact: {
            name: name.trim(),
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
          },
          fields: {
            // validation reads `fields`, /hq reads both — mirror name here
            name: name.trim(),
            situation: "estate_settlement",
            timeframe: "asap",
            city: city.trim() || undefined,
            preferred_date: day,
            preferred_window: win,
            details: `WALKTHROUGH REQUEST — ${label}, ${windowLabel?.label} (${windowLabel?.hint})${
              notes.trim() ? `\n\n${notes.trim()}` : ""
            }`,
          },
        }),
      });
      if (!res.ok) throw new Error(`lead action failed (${res.status})`);
      setStatus("success");
    } catch {
      setStatus("error");
      setErr("That didn't go through. Call or text and we'll sort it out.");
    }
  }

  if (status === "success") {
    const chosen = days.find((d) => d.iso === day);
    return (
      <div className="es-sale-plate p-8 text-center">
        <p className="es-kicker justify-center">Requested</p>
        <h3 className="es-display mt-4 text-2xl">We&apos;ll confirm shortly.</h3>
        <p className="mx-auto mt-3 max-w-md text-sm" style={{ color: "var(--es-cream-dim)" }}>
          You asked for <strong style={{ color: "var(--es-cream)" }}>
            {chosen ? `${chosen.dow}, ${chosen.mon} ${chosen.day}` : day}
          </strong>{" "}
          — {WINDOWS.find((w) => w.value === win)?.label.toLowerCase()}. Jared will call or text to
          lock the exact time. If you&apos;d rather just talk now, he picks up.
        </p>
        <a href={ES_PHONE_TEL} className="es-btn-primary mt-6 inline-block px-6 py-3 text-sm">
          {ES_PHONE}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="es-panel p-6 sm:p-8">
      <p className="es-kicker">Book a walkthrough</p>
      <h3 className="es-display mt-4 text-2xl sm:text-3xl">Pick a day. We&apos;ll be there.</h3>
      <p className="mt-3 max-w-lg text-sm" style={{ color: "var(--es-cream-dim)" }}>
        Free, no obligation, usually within the week — often the same day. We walk the home, talk
        through what you&apos;re facing, and give you a real number. Nothing is signed at the
        walkthrough.
      </p>

      <fieldset className="mt-7">
        <legend className="mb-3 text-[0.68rem] tracking-[0.24em] uppercase" style={{ color: "var(--es-brass)" }}>
          Preferred day
        </legend>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {days.map((d) => (
            <button
              type="button"
              key={d.iso}
              aria-pressed={day === d.iso}
              onClick={() => setDay(d.iso)}
              className="es-chip shrink-0"
            >
              <span>{d.dow}</span>
              <span className="es-chip-d">{d.day}</span>
              <span style={{ opacity: 0.6 }}>{d.mon}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="mb-3 text-[0.68rem] tracking-[0.24em] uppercase" style={{ color: "var(--es-brass)" }}>
          Time of day
        </legend>
        <div className="flex flex-wrap gap-2">
          {WINDOWS.map((w) => (
            <button
              type="button"
              key={w.value}
              aria-pressed={win === w.value}
              onClick={() => setWin(w.value)}
              className="es-chip shrink-0 px-5"
            >
              <span className="es-chip-d text-base">{w.label}</span>
              <span style={{ opacity: 0.6 }}>{w.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <input
          className="es-input"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        <input
          className="es-input"
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          autoComplete="tel"
        />
        <input
          className="es-input"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
        />
        <input
          className="es-input"
          placeholder="City or neighborhood"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>

      <textarea
        className="es-input mt-3 min-h-[5rem] w-full"
        placeholder="Anything we should know? (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {status === "error" ? (
        <p className="mt-3 text-sm" style={{ color: "#e8a0a0" }}>
          {err}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="es-btn-primary mt-5 w-full px-6 py-3.5 text-sm disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Request this walkthrough"}
      </button>

      <p className="mt-4 text-center text-xs" style={{ color: "rgba(243,234,217,0.4)" }}>
        Or just call — <a href={ES_PHONE_TEL} className="underline">{ES_PHONE}</a>. Zero upfront cost,
        30% commission, no minimum sale size.
      </p>
    </form>
  );
}
