"use client";

import { useState } from "react";
import { CL_PHONE, CL_PHONE_SMS, CL_SERVICE_OPTIONS } from "@/lib/clean";

type FormStatus = "idle" | "submitting" | "success" | "error";

export function CleanQuoteForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [service, setService] = useState(CL_SERVICE_OPTIONS[0]);
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMsg("");

    // Fold the chosen service into the notes so the lead carries context,
    // and post to the shared cleanout-quote endpoint (never-drop-a-lead).
    const composed = `Service: ${service}${details ? `\n\n${details}` : ""}`;

    try {
      const res = await fetch("/api/cleanouts/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, address, details: composed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(
          (data && typeof data.error === "string" && data.error) ||
            `Something went wrong (HTTP ${res.status}). Call or text us instead — ${CL_PHONE}.`,
        );
        return;
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        `Couldn't reach the server (${err instanceof Error ? err.message : "network error"}). ` +
          `Call or text us instead — ${CL_PHONE}.`,
      );
    }
  }

  if (status === "success") {
    return (
      <div className="cl-plate p-8 text-center">
        <h3 className="cl-display text-2xl text-white">Got it — we&apos;ll be in touch</h3>
        <p className="mt-3 text-sm text-white/60">
          We&apos;ll call or text you back, usually same day, to set up a quote. Want it even
          faster?{" "}
          <a href={CL_PHONE_SMS} className="font-semibold text-[#ff7a1a] underline underline-offset-2">
            Text photos to {CL_PHONE}
          </a>{" "}
          right now.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="cl-form space-y-4 p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cl-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
            Name
          </label>
          <input
            id="cl-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            className="cl-input px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="cl-phone" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
            Phone <span className="text-[#ff7a1a]">*</span>
          </label>
          <input
            id="cl-phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(816) 555-0123"
            autoComplete="tel"
            className="cl-input px-3.5 py-2.5 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cl-service" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
            What do you need?
          </label>
          <select
            id="cl-service"
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="cl-input px-3.5 py-2.5 text-sm"
          >
            {CL_SERVICE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cl-address" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
            Address / area
          </label>
          <input
            id="cl-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street address or city"
            autoComplete="street-address"
            className="cl-input px-3.5 py-2.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="cl-details" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
          Tell us about the job
        </label>
        <textarea
          id="cl-details"
          rows={4}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="e.g. garage full of junk to haul off — or — move a car from Independence to Lee's Summit"
          className="cl-input resize-y px-3.5 py-2.5 text-sm"
        />
      </div>

      {status === "error" && (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="cl-btn-primary w-full rounded px-6 py-3.5 text-base font-bold disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Get My Free Quote"}
      </button>

      <p className="text-center text-xs text-white/40">
        Fastest quote:{" "}
        <a href={CL_PHONE_SMS} className="font-semibold text-[#ff7a1a] underline underline-offset-2">
          text photos to {CL_PHONE}
        </a>
      </p>
    </form>
  );
}
