"use client";

import { useState } from "react";
import { TC_PHONE, TC_PHONE_SMS } from "@/lib/cleanouts";

type FormStatus = "idle" | "submitting" | "success" | "error";

export function CleanoutQuoteForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/cleanouts/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, address, details }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(
          (data && typeof data.error === "string" && data.error) ||
            `Something went wrong (HTTP ${res.status}). Call or text us instead — ${TC_PHONE}.`,
        );
        return;
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        `Couldn't reach the server (${err instanceof Error ? err.message : "network error"}). ` +
          `Call or text us instead — ${TC_PHONE}.`,
      );
    }
  }

  if (status === "success") {
    return (
      <div className="tc-diff p-8 text-center">
        <h3 className="tc-display text-2xl text-white">Got it — quote coming your way</h3>
        <p className="mt-3 text-sm text-white/60">
          We&apos;ll call or text you back, usually same day. Want it even faster?{" "}
          <a href={TC_PHONE_SMS} className="font-semibold text-[#ff7a1a] underline underline-offset-2">
            Text photos to {TC_PHONE}
          </a>{" "}
          right now.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="tc-form space-y-4 p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tc-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
            Name
          </label>
          <input
            id="tc-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            className="tc-input px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="tc-phone" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
            Phone <span className="text-[#ff7a1a]">*</span>
          </label>
          <input
            id="tc-phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(816) 555-0123"
            autoComplete="tel"
            className="tc-input px-3.5 py-2.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="tc-address" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
          Address
        </label>
        <input
          id="tc-address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street address, city"
          autoComplete="street-address"
          className="tc-input px-3.5 py-2.5 text-sm"
        />
      </div>

      <div>
        <label htmlFor="tc-details" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
          What needs clearing?
        </label>
        <textarea
          id="tc-details"
          rows={4}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="e.g. 2-bed rental unit, full of furniture and boxes — tenant moved out last week"
          className="tc-input resize-y px-3.5 py-2.5 text-sm"
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
        className="tc-btn-primary w-full rounded px-6 py-3.5 text-base font-bold disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Get My Free Quote"}
      </button>

      <p className="text-center text-xs text-white/40">
        Fastest quote:{" "}
        <a href={TC_PHONE_SMS} className="font-semibold text-[#ff7a1a] underline underline-offset-2">
          text photos to {TC_PHONE}
        </a>
      </p>
    </form>
  );
}
