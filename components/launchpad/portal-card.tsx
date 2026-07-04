"use client";

import { useState } from "react";
import { formatOfferingPrice, type Offering, type OfferingKind } from "@/lib/launchpad";

export type PortalStorefront = {
  slug: string;
  businessName: string;
  categoryLabel: string;
  status: string; // operator status
  sellingEnabled: boolean;
  tagline: string;
  about: string;
  city: string;
  phone: string;
  offerings: Offering[];
};

export type PortalSale = {
  id: string;
  offeringName: string;
  amountCents: number;
  kind: string;
  buyerName: string | null;
  buyerEmail: string | null;
  createdAt: string;
};

type OfferingRow = { name: string; price: string; kind: OfferingKind };

function toRows(offerings: Offering[]): OfferingRow[] {
  const rows = offerings.map((o) => ({
    name: o.name,
    price: o.priceCents ? (o.priceCents / 100).toString() : "",
    kind: o.kind,
  }));
  return rows.length ? rows : [{ name: "", price: "", kind: "one_time" }];
}

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pending Jared's handshake — ordering is locked", tone: "#ff8842" },
  approved: { label: "Approved — your Buy buttons are live", tone: "#39d98a" },
  paused: { label: "Paused by Jared — ordering is temporarily off", tone: "#ffb020" },
  bought_out: { label: "Bought out — this operation is yours now", tone: "#8ab4ff" },
};

export function PortalCard({
  storefront,
  sales,
}: {
  storefront: PortalStorefront;
  sales: PortalSale[];
}) {
  const [tagline, setTagline] = useState(storefront.tagline);
  const [about, setAbout] = useState(storefront.about);
  const [city, setCity] = useState(storefront.city);
  const [phone, setPhone] = useState(storefront.phone);
  const [rows, setRows] = useState<OfferingRow[]>(toRows(storefront.offerings));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [buyoutState, setBuyoutState] = useState<"idle" | "sending" | "sent">("idle");

  const status = STATUS_COPY[storefront.status] ?? STATUS_COPY.pending;
  const shareUrl = `https://www.tolley.io/biz/${storefront.slug}`;

  function updateRow(i: number, patch: Partial<OfferingRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => (prev.length >= 6 ? prev : [...prev, { name: "", price: "", kind: "one_time" }]));
  }
  function removeRow(i: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function save() {
    setSaving(true);
    setErr(null);
    setSaved(false);
    const offerings = rows
      .map((r) => ({
        name: r.name.trim(),
        priceCents: Math.max(0, Math.round(parseFloat(r.price || "0") * 100)) || 0,
        kind: r.kind,
      }))
      .filter((o) => o.name.length > 0);
    try {
      const res = await fetch("/api/sales/portal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: storefront.slug,
          tagline: tagline || null,
          about: about || null,
          city: city || null,
          phone: phone || null,
          offerings,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErr((data && data.error) || "Couldn't save.");
      } else {
        setSaved(true);
      }
    } catch {
      setErr("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function requestBuyout() {
    if (buyoutState !== "idle") return;
    if (!window.confirm("Send Jared a buyout request for this business?")) return;
    setBuyoutState("sending");
    try {
      const res = await fetch("/api/sales/buyout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: storefront.slug }),
      });
      if (res.ok) setBuyoutState("sent");
      else setBuyoutState("idle");
    } catch {
      setBuyoutState("idle");
    }
  }

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked — link is visible anyway */
    }
  }

  const totalCents = sales.reduce((sum, s) => sum + s.amountCents, 0);

  return (
    <div
      className="rounded-2xl p-6"
      style={{ backgroundColor: "#1c1e22", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">{storefront.businessName}</h2>
          <p className="mt-0.5 text-xs uppercase tracking-widest" style={{ color: "#a7a49d" }}>
            {storefront.categoryLabel}
          </p>
        </div>
        <a
          href={`/biz/${storefront.slug}`}
          target="_blank"
          className="rounded-full px-4 py-2 text-sm font-semibold"
          style={{ backgroundColor: "#26282d", color: "#ff8842" }}
        >
          View site →
        </a>
      </div>

      {/* Status */}
      <div
        className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
        style={{ backgroundColor: "#141518", color: status.tone }}
      >
        <span>●</span> {status.label}
      </div>

      {/* Share link */}
      <div className="mt-4">
        <p className="text-xs uppercase tracking-widest" style={{ color: "#a7a49d" }}>
          Share your site
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <code
            className="flex-1 truncate rounded-lg px-3 py-2 text-xs"
            style={{ backgroundColor: "#141518", color: "#d8d5cf" }}
          >
            {shareUrl}
          </code>
          <button
            type="button"
            onClick={copyShare}
            className="rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ backgroundColor: "#ff6a13", color: "#141518" }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Sales */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-widest" style={{ color: "#a7a49d" }}>
            Sales
          </p>
          <p className="text-sm font-bold text-white">
            {sales.length} · ${(totalCents / 100).toFixed(2)}
          </p>
        </div>
        {sales.length === 0 ? (
          <p className="mt-1.5 text-sm" style={{ color: "#a7a49d" }}>
            No sales yet. Share your link — orders show up here the moment they land.
          </p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {sales.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                style={{ backgroundColor: "#141518", color: "#d8d5cf" }}
              >
                <span className="truncate">
                  {s.offeringName}
                  {s.buyerName ? ` · ${s.buyerName}` : ""}
                </span>
                <span className="ml-3 shrink-0 font-semibold text-white">
                  {formatOfferingPrice({ name: s.offeringName, priceCents: s.amountCents, kind: s.kind as OfferingKind })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      <details className="mt-6 group">
        <summary className="cursor-pointer text-sm font-semibold" style={{ color: "#ff8842" }}>
          Edit your storefront copy & offerings
        </summary>
        <div className="mt-4 space-y-3">
          <Field label="Tagline (headline)">
            <input className={inputCls} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Leave blank to use the default" />
          </Field>
          <Field label="About">
            <textarea className={inputCls} rows={3} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="A sentence or two about the business" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="Phone">
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-xs uppercase tracking-widest" style={{ color: "#a7a49d" }}>
              Offerings
            </p>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_5rem_6rem_auto] items-center gap-2">
                  <input className={inputCls} value={r.name} onChange={(e) => updateRow(i, { name: e.target.value })} placeholder="Name" />
                  <input className={inputCls} inputMode="decimal" value={r.price} onChange={(e) => updateRow(i, { price: e.target.value })} placeholder="$" />
                  <select className={inputCls} value={r.kind} onChange={(e) => updateRow(i, { kind: e.target.value as OfferingKind })}>
                    <option value="one_time">one-time</option>
                    <option value="monthly">monthly</option>
                  </select>
                  <button type="button" onClick={() => removeRow(i)} disabled={rows.length <= 1} className="px-2 text-sm" style={{ color: "#a7a49d" }}>✕</button>
                </div>
              ))}
            </div>
            {rows.length < 6 && (
              <button type="button" onClick={addRow} className="mt-2 text-xs underline underline-offset-2" style={{ color: "#a7a49d" }}>
                + add offering
              </button>
            )}
          </div>

          {err && <p className="text-sm text-rose-300">{err}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-full px-5 py-2 text-sm font-bold disabled:opacity-60"
              style={{ backgroundColor: "#ff6a13", color: "#141518" }}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {saved && <span className="text-sm" style={{ color: "#39d98a" }}>Saved ✓</span>}
          </div>
        </div>
      </details>

      {/* Buyout */}
      {storefront.status !== "bought_out" && (
        <div className="mt-6 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          {buyoutState === "sent" ? (
            <p className="text-sm" style={{ color: "#39d98a" }}>
              Buyout request sent. Jared will reach out with a number.
            </p>
          ) : (
            <button
              type="button"
              onClick={requestBuyout}
              disabled={buyoutState === "sending"}
              className="text-sm font-semibold underline underline-offset-2 disabled:opacity-60"
              style={{ color: "#ff8842" }}
            >
              {buyoutState === "sending" ? "Sending…" : "Request a buyout →"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-[#141518] px-3 py-2 text-sm text-[#f4f2ee] outline-none focus:border-[#ff6a13]/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-widest" style={{ color: "#a7a49d" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
