"use client";

import { useState } from "react";
import {
  LP_STOP_OPTIONS,
  LP_NEED_OPTIONS,
  LP_PHONE_SMS,
  LP_PHONE,
} from "@/lib/sales";
import { DEMO_THEME_OPTIONS } from "@/lib/demo-site";

type FormStatus = "idle" | "submitting" | "success" | "error";

type OfferingRow = {
  name: string;
  price: string; // dollars, as typed
  kind: "one_time" | "monthly";
};

const EMPTY_OFFERING: OfferingRow = { name: "", price: "", kind: "one_time" };

export function LaunchpadIntakeForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("generic");
  const [city, setCity] = useState("");
  const [idea, setIdea] = useState("");
  const [offerings, setOfferings] = useState<OfferingRow[]>([{ ...EMPTY_OFFERING }]);
  const [stopping, setStopping] = useState<string[]>([]);
  const [needFirst, setNeedFirst] = useState("all");
  const [heardAbout, setHeardAbout] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);

  function toggleStop(code: string) {
    setStopping((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function updateOffering(i: number, patch: Partial<OfferingRow>) {
    setOfferings((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  function addOffering() {
    setOfferings((prev) => (prev.length >= 3 ? prev : [...prev, { ...EMPTY_OFFERING }]));
  }

  function removeOffering(i: number) {
    setOfferings((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  /** Named offering rows → the {name,priceCents,kind} JSON provision expects. */
  function buildOfferings() {
    return offerings
      .map((o) => ({
        name: o.name.trim(),
        priceCents: Math.max(0, Math.round(parseFloat(o.price || "0") * 100)) || 0,
        kind: o.kind,
      }))
      .filter((o) => o.name.length > 0);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMsg("");

    const cleanOfferings = buildOfferings();

    const body = {
      subsite: "sales",
      action: "launchpad_intake",
      contact: {
        name: name.trim() || undefined,
        phone: phone.trim(),
      },
      fields: {
        idea: idea.trim(),
        business_name: businessName.trim(),
        category,
        city: city.trim() || undefined,
        offerings: cleanOfferings.length ? JSON.stringify(cleanOfferings) : undefined,
        stopping: stopping.join(", "),
        need_first: needFirst,
        heard_about: heardAbout.trim() || undefined,
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
      const receiptToken = data?.receiptToken ?? null;
      setReceipt(receiptToken);

      // The wow: provision the preview storefront and jump straight to it.
      if (businessName.trim()) {
        try {
          const prov = await fetch("/api/sales/provision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              receiptToken,
              businessName: businessName.trim(),
              category,
              city: city.trim() || undefined,
              phone: phone.trim() || undefined,
              name: name.trim() || undefined,
              idea: idea.trim(),
              offerings: cleanOfferings,
            }),
          });
          const provData = await prov.json().catch(() => null);
          if (prov.ok && provData?.url) {
            window.location.assign(`${provData.url}?fresh=1`);
            return;
          }
        } catch {
          // Provision is best-effort — the lead is already saved. Fall through
          // to the normal "got it" confirmation below.
        }
      }

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
          <span className="lp-marker text-2xl">got it.</span>
          <p className="mt-3 text-base leading-relaxed">
            Your idea&apos;s on my desk. I read every one of these myself — I&apos;ll call or text
            you back, usually within a day.
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
            <span className="lp-display text-xl sm:text-2xl">Work Order</span>
            <span className="lp-ticket-num text-xs">No. 001 · Launchpad Intake</span>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="lp-name" className="lp-field-label mb-1.5 block">
                Your name
              </label>
              <input
                id="lp-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First name's fine"
                autoComplete="name"
                className="lp-input px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="lp-phone" className="lp-field-label mb-1.5 block">
                Phone <span className="text-[color:var(--lp-rust)]">*</span>
              </label>
              <input
                id="lp-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(816) 555-0123 — text-first is fine"
                autoComplete="tel"
                className="lp-input px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* ── The site-builder fields: name it, and a preview goes live ── */}
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="lp-biz" className="lp-field-label mb-1.5 block">
                Name your business <span className="text-[color:var(--lp-rust)]">*</span>
              </label>
              <input
                id="lp-biz"
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ridgeline Essentials Box"
                className="lp-input px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="lp-city" className="lp-field-label mb-1.5 block">
                City you&apos;ll serve
              </label>
              <input
                id="lp-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Independence, MO"
                className="lp-input px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="lp-cat" className="lp-field-label mb-1.5 block">
              What kind of business? (sets your site&apos;s look)
            </label>
            <select
              id="lp-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="lp-input px-3.5 py-2.5 text-sm"
            >
              {DEMO_THEME_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5">
            <label htmlFor="lp-idea" className="lp-field-label mb-1.5 block">
              Your idea, in your own words <span className="text-[color:var(--lp-rust)]">*</span>
            </label>
            <textarea
              id="lp-idea"
              required
              rows={4}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g. I want to sell lawn care to my street, but I don't have a mower or a way to take payment."
              className="lp-input resize-y px-3.5 py-2.5 text-sm"
            />
          </div>

          {/* ── Offerings (optional — skippable, Jared can set them later) ── */}
          <div className="mt-5">
            <span className="lp-field-label mb-2 block">
              What are you selling? (optional — add up to 3)
            </span>
            <div className="grid gap-2.5">
              {offerings.map((o, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
                >
                  <input
                    type="text"
                    value={o.name}
                    onChange={(e) => updateOffering(i, { name: e.target.value })}
                    placeholder={`Offering ${i + 1} — e.g. Monthly Box`}
                    className="lp-input px-3.5 py-2.5 text-sm"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={o.price}
                    onChange={(e) => updateOffering(i, { price: e.target.value })}
                    placeholder="$ price"
                    className="lp-input px-3.5 py-2.5 text-sm sm:w-28"
                  />
                  <select
                    value={o.kind}
                    onChange={(e) =>
                      updateOffering(i, { kind: e.target.value as OfferingRow["kind"] })
                    }
                    className="lp-input px-3 py-2.5 text-sm sm:w-32"
                  >
                    <option value="one_time">one-time</option>
                    <option value="monthly">monthly</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeOffering(i)}
                    disabled={offerings.length <= 1}
                    aria-label="Remove offering"
                    className="lp-mono rounded px-3 py-2.5 text-sm opacity-60 transition hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-20"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            {offerings.length < 3 && (
              <button
                type="button"
                onClick={addOffering}
                className="lp-mono mt-2 text-xs underline underline-offset-2 opacity-70 transition hover:opacity-100"
              >
                + add another offering
              </button>
            )}
          </div>

          <div className="mt-5">
            <span className="lp-field-label mb-2 block">
              What&apos;s stopping you today? (check any that apply)
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              {LP_STOP_OPTIONS.map((opt) => (
                <label key={opt.code} className="lp-check flex items-center gap-2 px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={stopping.includes(opt.code)}
                    onChange={() => toggleStop(opt.code)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="lp-need" className="lp-field-label mb-1.5 block">
                What do you need first?
              </label>
              <select
                id="lp-need"
                value={needFirst}
                onChange={(e) => setNeedFirst(e.target.value)}
                className="lp-input px-3.5 py-2.5 text-sm"
              >
                {LP_NEED_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lp-heard" className="lp-field-label mb-1.5 block">
                How&apos;d you hear about me?
              </label>
              <input
                id="lp-heard"
                type="text"
                value={heardAbout}
                onChange={(e) => setHeardAbout(e.target.value)}
                placeholder="Facebook, a friend, word of mouth..."
                className="lp-input px-3.5 py-2.5 text-sm"
              />
            </div>
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
            {status === "submitting" ? "Building your site…" : "Build My Site & Send My Idea"}
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
