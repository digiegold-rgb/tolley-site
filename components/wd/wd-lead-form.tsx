"use client";

import { useRef, useState } from "react";
import { submitLead, captureAttribution } from "@/lib/lead-capture-client";
import { useSearchParams } from "next/navigation";
import { trackEvent } from "@/components/analytics/site-tracker";
import { gtagEvent } from "@/components/analytics/ga4";
import { fbqEvent } from "@/components/analytics/meta-pixel";
import { WD_CONTACT_PHONE } from "@/lib/wd";

export function WdLeadForm() {
  const params = useSearchParams();
  const promo = params.get("promo") || params.get("code") || "";
  const requestId = useRef<string | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    zip: "",
    unit: "bundle",
    promo,
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    if (!form.name.trim() || (!form.phone.trim() && !form.email.trim()) || !/^\d{5}$/.test(form.zip)) {
      setError("Enter your name, a phone or email, and a five-digit delivery ZIP.");
      return;
    }

    setStatus("sending");
    setError("");
    try {
      requestId.current ??= crypto.randomUUID();
      await submitLead("/api/lead/action", {
        requestId: requestId.current,
        subsite: "wd", action: "request_wd_quote",
        contact: { name: form.name.trim(), phone: form.phone.trim() || undefined, email: form.email.trim() || undefined },
        fields: { zip: form.zip, unit_type: form.unit, address: form.address.trim(),
          notes: form.message.trim(), promo: form.promo, ...captureAttribution() },
      });

      trackEvent("wd", "lead_submit", form.unit, { promo: form.promo });
      gtagEvent("generate_lead", { value: 58, currency: "USD" });
      fbqEvent("Lead", { content_name: form.unit });

      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again or call us.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-lg shadow-blue-100/50 sm:p-8 text-center">
        <div className="text-4xl mb-3">&#127881;</div>
        <h2 className="text-xl font-bold text-blue-900">We Got Your Info!</h2>
        <p className="mt-2 text-sm text-slate-600">
          We&apos;ll reach out within 24 hours to schedule your delivery. Questions? Call us
          at{" "}
          <a href={`tel:${WD_CONTACT_PHONE}`} className="font-semibold text-blue-600 underline">
            {WD_CONTACT_PHONE}
          </a>
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-lg shadow-blue-100/50 sm:p-8">
      <h2 className="text-xl font-bold text-blue-900">Get a Free Quote</h2>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <p className="mt-1 text-sm text-slate-600">
        Not ready to checkout? Drop your info and we&apos;ll reach out with details.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <input
          type="text"
          placeholder="Your name *"
          required
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          className="wd-input w-full"
        />
        <input
          type="tel"
          placeholder="Phone number"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          className="wd-input w-full"
        />
        <input
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          className="wd-input w-full"
        />
        <input
          type="text"
          placeholder="Delivery address (city/zip)"
          value={form.address}
          onChange={(e) => update("address", e.target.value)}
          className="wd-input w-full"
        />

        <input aria-label="Delivery ZIP" placeholder="Delivery ZIP *" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required value={form.zip} onChange={(e) => update("zip", e.target.value)} className="wd-input w-full" />

        <select
          value={form.unit}
          onChange={(e) => update("unit", e.target.value)}
          className="wd-input w-full"
        >
          <option value="washer">Washer only ($42/mo)</option>
          <option value="bundle">Washer + Dryer ($58/mo)</option>
        </select>

        {promo ? (
          <input
            type="text"
            placeholder="Promo code"
            value={form.promo}
            onChange={(e) => update("promo", e.target.value)}
            className="wd-input w-full"
          />
        ) : (
          <input
            type="text"
            placeholder="Promo code (optional)"
            value={form.promo}
            onChange={(e) => update("promo", e.target.value)}
            className="wd-input w-full"
          />
        )}

        <textarea
          placeholder="Anything else we should know? (optional)"
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
          className="wd-input w-full sm:col-span-2"
          rows={2}
        />

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={status === "sending" || (!form.phone && !form.email)}
            className="wd-glow inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-8 py-3 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
          >
            {status === "sending" ? "Sending..." : "Get My Free Quote"}
          </button>
          <p className="mt-2 text-xs text-slate-400">
            * Name + phone or email required. We&apos;ll never spam you.
          </p>
        </div>
      </form>

      {status === "error" && (
        <p className="mt-3 text-sm text-red-500">
          Something went wrong. Please call us at{" "}
          <a href={`tel:${WD_CONTACT_PHONE}`} className="font-semibold underline">
            {WD_CONTACT_PHONE}
          </a>
        </p>
      )}
    </section>
  );
}
