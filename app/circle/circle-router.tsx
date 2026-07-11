"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/components/analytics/site-tracker";
import type { FlywheelGroup, FlywheelProduct } from "./circle-flywheel";

/**
 * "What do you need?" — the circle's capture moment. Two steps: pick a need,
 * pick the product. Contact info is optional: with it we create a real
 * LeadAction (verb `route-me` on the `circle` manifest) that lands in the /hq
 * Inbox, without it we still route the visitor (never block the visit) and
 * log a SiteEvent instead. Either way they exit onto the live subsite with
 * ?ref=circle so attribution follows them.
 */

function getRef(): string {
  if (typeof window === "undefined") return "";
  const p = new URLSearchParams(window.location.search);
  return p.get("ref") || p.get("utm_source") || document.referrer || "direct";
}

export function CircleRouter({ groups }: { groups: FlywheelGroup[] }) {
  const router = useRouter();
  const [need, setNeed] = useState<FlywheelGroup | null>(null);
  const [product, setProduct] = useState<FlywheelProduct | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasContact = email.trim().includes("@") || phone.replace(/\D/g, "").length >= 7;

  async function go() {
    if (!need || !product) return;
    setBusy(true);
    setError(null);
    const dest = `${product.url}?ref=circle`;

    if (hasContact) {
      try {
        const res = await fetch("/api/lead/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subsite: "circle",
            action: "route-me",
            contact: {
              ...(email.trim() ? { email: email.trim() } : {}),
              ...(phone.trim() ? { phone: phone.trim() } : {}),
              ...(name.trim() ? { name: name.trim() } : {}),
            },
            fields: {
              need: need.group,
              product: product.name,
              ...(note.trim() ? { note: note.trim() } : {}),
              ref: getRef(),
            },
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
      } catch (e) {
        // Don't strand the visitor — surface the error but still let them route.
        setError(e instanceof Error ? e.message : "Couldn't save your info");
        setBusy(false);
        return;
      }
    } else {
      trackEvent("circle", "route-skip", product.name, { need: need.group });
    }
    router.push(dest);
  }

  return (
    <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
      <h2 className="text-center text-2xl font-black text-white">What do you need?</h2>
      <p className="mt-2 text-center text-sm text-neutral-400">
        Pick one. I&apos;ll take you straight there — leave your info and I&apos;ll personally follow up.
      </p>

      {/* Step 1: need */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {groups.map((g) => (
          <button
            key={g.group}
            onClick={() => {
              setNeed(g);
              setProduct(g.entries.length === 1 ? g.entries[0] : null);
            }}
            className={`rounded-2xl border px-3 py-4 text-center transition ${
              need?.group === g.group
                ? "border-white/60 bg-white/10"
                : "border-white/10 bg-black/20 hover:border-white/30"
            }`}
            style={need?.group === g.group ? { borderColor: g.color } : undefined}
          >
            <span className="block text-2xl" aria-hidden="true">{g.emoji}</span>
            <span className="mt-1 block text-xs font-bold text-white">{g.group}</span>
          </button>
        ))}
      </div>

      {/* Step 2: product */}
      {need && (
        <div className="mt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">
            {need.emoji} {need.group} — pick your spot
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {need.entries.map((p) => (
              <button
                key={p.name}
                onClick={() => setProduct(p)}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  product?.name === p.name
                    ? "border-white/60 bg-white/10"
                    : "border-white/10 bg-black/20 hover:border-white/30"
                }`}
              >
                <span className="text-lg" aria-hidden="true">{p.emoji}</span>
                <span>
                  <span className="block text-sm font-bold text-white">{p.title}</span>
                  <span className="block text-xs text-neutral-400">{p.tagline}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: optional contact + go */}
      {product && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5">
          <p className="text-sm font-bold text-white">
            Headed to {product.emoji} {product.title}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Optional: drop your info and it lands on my desk before you even get there.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
            />
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What are you looking for? (optional)"
            rows={2}
            className="mt-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
          />
          {error && <p className="mt-2 text-xs text-red-400">{error} — you can still head over without saving.</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={go}
              disabled={busy}
              className="rounded-full bg-purple-500 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-purple-400 disabled:opacity-50"
            >
              {busy ? "Saving…" : hasContact ? "Save my info & take me there →" : "Just take me there →"}
            </button>
            {error && (
              <button
                onClick={() => router.push(`${product.url}?ref=circle`)}
                className="text-xs font-semibold text-neutral-400 underline transition hover:text-white"
              >
                skip & go
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
