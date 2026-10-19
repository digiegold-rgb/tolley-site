"use client";

import { useRef, useState } from "react";
import { browserAttribution } from "@/lib/discovery-browser";
import { captureAttribution, submitLead } from "@/lib/lead-capture-client";
import { WD_CONTACT_PHONE } from "@/lib/wd";
import { WD_OUT_OF_AREA_MESSAGE } from "@/lib/wd-service-zips";

export function WdOutOfAreaCapture({
  zip,
  unitType,
}: {
  zip: string;
  unitType: "washer" | "bundle";
}) {
  const requestId = useRef<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    if (phone.replace(/\D/g, "").length < 7) {
      setError("Enter a phone number we can reach you at.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setError("");
    try {
      requestId.current ??= crypto.randomUUID();
      await submitLead("/api/lead/action", {
        requestId: requestId.current,
        attribution: browserAttribution(),
        subsite: "wd",
        action: "request_wd_quote",
        contact: { phone: phone.trim(), ...(name.trim() ? { name: name.trim() } : {}) },
        fields: { zip, unit_type: unitType, ...captureAttribution() },
      });
      setStatus("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again or call us.");
      setStatus("error");
    }
  }

  return (
    <div>
      <p className="text-sm leading-relaxed text-slate-700">{WD_OUT_OF_AREA_MESSAGE}</p>
      {status === "saved" ? (
        <p className="mt-3 text-sm font-semibold text-blue-800">We saved your number.</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 grid gap-2">
          <input
            type="text"
            placeholder="Name (optional)"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="wd-input w-full"
          />
          <input
            type="tel"
            required
            placeholder="Phone number *"
            autoComplete="tel"
            aria-label="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="wd-input w-full"
          />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={status === "sending"}
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "sending" ? "Saving..." : "Leave my number"}
          </button>
          <p className="text-xs text-slate-500">
            Or call{" "}
            <a href={`tel:${WD_CONTACT_PHONE}`} className="font-semibold text-blue-600 underline">
              {WD_CONTACT_PHONE}
            </a>
            .
          </p>
        </form>
      )}
    </div>
  );
}
