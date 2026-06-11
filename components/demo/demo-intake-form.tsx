"use client";

// Post-payment onboarding form for /demo/[slug]/welcome. POSTs to
// /api/demo/intake which appends the answers to the GrowthLead.notes and
// drops a GrowthTouch (channel="note", direction="in", status="received") so
// the intake lands in /hq for the build. Errors surface via Toast — no silent
// catch — and this island brings its own ToastProvider (demo pages have none).

import { useState, type FormEvent } from "react";

import { ToastProvider, useToast } from "@/components/ui/Toast";
import { DEMO_TOLLEY_PHONE } from "@/lib/demo-site";

function IntakeFormInner({ slug }: { slug: string }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [hours, setHours] = useState("");
  const [assets, setAssets] = useState("");
  const [domain, setDomain] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/demo/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          hours: hours.trim(),
          assets: assets.trim(),
          domain: domain.trim(),
          notes: notes.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      setDone(true);
      toast({
        title: "Got it — thank you!",
        description: "Cordless has everything to start building.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Couldn't save your details",
        description:
          err instanceof Error
            ? err.message
            : `Call or text ${DEMO_TOLLEY_PHONE} and we'll grab them.`,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-center">
        <p className="text-sm font-semibold text-emerald-300">
          Details received ✓
        </p>
        <p className="mt-1 text-xs text-white/55">
          Your build is queued — we&apos;ll be in touch as it comes together.
        </p>
      </div>
    );
  }

  const fieldClass =
    "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-amber-400/60 focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-white/70">Business hours</span>
        <textarea
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="e.g. Mon–Fri 8–6, Sat 9–2, closed Sunday"
          maxLength={1000}
          rows={2}
          className={`resize-none ${fieldClass}`}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-white/70">
          Logo &amp; photos
        </span>
        <textarea
          value={assets}
          onChange={(e) => setAssets(e.target.value)}
          placeholder="Paste a link (Google Drive, Dropbox, etc.) or tell us where to grab them — or write 'use my Facebook photos'."
          maxLength={2000}
          rows={3}
          className={`resize-none ${fieldClass}`}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-white/70">
          Preferred domain
        </span>
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="e.g. yourbusiness.com (or 'pick one for me')"
          maxLength={300}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-white/70">
          Anything else
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Services to highlight, colors you love/hate, a competitor site you like — anything."
          maxLength={2000}
          rows={3}
          className={`resize-none ${fieldClass}`}
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#1a1405] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Send details — start my build"}
      </button>
    </form>
  );
}

export function DemoIntakeForm({ slug }: { slug: string }) {
  return (
    <ToastProvider>
      <IntakeFormInner slug={slug} />
    </ToastProvider>
  );
}
