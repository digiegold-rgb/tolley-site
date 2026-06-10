"use client";

// Floating Tolley Digital pitch banner for /demo/[slug] previews.
// Fixed to the bottom of every demo page regardless of category theme —
// this is the offer: "$500 setup + $49/mo, live this week." The claim form
// POSTs to /api/demo/claim which drops a GrowthTouch (channel=demo,
// direction=in, status=received) on the lead — a hand-raise that lands in
// the /hq queue. Errors surface via the repo Toast pattern, never silently.

import { useState, type FormEvent } from "react";

import { ToastProvider, useToast } from "@/components/ui/Toast";
import {
  DEMO_TOLLEY_PHONE,
  DEMO_TOLLEY_PHONE_TEL,
  DEMO_TOLLEY_SMS,
} from "@/lib/demo-site";

function ClaimBannerInner({
  slug,
  businessName,
}: {
  slug: string;
  businessName: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [contact, setContact] = useState("");
  const [fromName, setFromName] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!contact.trim()) {
      toast({
        title: "Add a phone or email",
        description: "We need a way to reach you to get the site live.",
        variant: "warning",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/demo/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: fromName.trim(),
          contact: contact.trim(),
          message: message.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      setClaimed(true);
      setOpen(false);
      toast({
        title: "Claim received",
        description: "Cordless will reach out shortly to get this live.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Couldn't send your claim",
        description:
          err instanceof Error
            ? err.message
            : `Call or text ${DEMO_TOLLEY_PHONE} instead.`,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Claim form sheet */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-24 sm:pb-28">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101319] p-5 shadow-2xl"
          >
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-white">
                Claim this site for {businessName}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close claim form"
                className="rounded p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-white/55">
              $500 setup, live this week, $49/mo hosting + updates after. Leave
              your info and Cordless will reach out — or skip the form and text{" "}
              <a href={DEMO_TOLLEY_SMS} className="font-medium text-amber-400 underline underline-offset-2">
                {DEMO_TOLLEY_PHONE}
              </a>
              .
            </p>
            <div className="flex flex-col gap-2.5">
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your name"
                maxLength={120}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-amber-400/60 focus:outline-none"
              />
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Phone or email (required)"
                maxLength={200}
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-amber-400/60 focus:outline-none"
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Anything you'd change about the preview? (optional)"
                maxLength={2000}
                rows={3}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-amber-400/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="mt-1 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#1a1405] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Claim this site"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating banner */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0c0f14]/95 px-3 py-3 backdrop-blur sm:px-5">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2.5 sm:flex-row sm:justify-between">
          <p className="text-center text-[0.72rem] leading-snug text-white/70 sm:text-left sm:text-xs">
            <span className="font-semibold text-white">
              Preview built for {businessName}
            </span>{" "}
            by Tolley Digital — Independence, MO
            <span className="hidden sm:inline"> · </span>
            <br className="sm:hidden" />
            Want this live this week?{" "}
            <span className="font-semibold text-amber-400">
              $500 setup + $49/mo
            </span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={DEMO_TOLLEY_PHONE_TEL}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-white/35 hover:bg-white/5"
            >
              Call
            </a>
            <a
              href={`${DEMO_TOLLEY_SMS}?body=${encodeURIComponent(
                `Hey, I saw the site preview for ${businessName} — let's talk.`
              )}`}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-white/35 hover:bg-white/5"
            >
              Text {DEMO_TOLLEY_PHONE}
            </a>
            {claimed ? (
              <span className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                Claim sent ✓
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-[#1a1405] transition hover:bg-amber-300"
              >
                Claim this site
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function DemoClaimBanner(props: { slug: string; businessName: string }) {
  // Demo pages have no global ToastProvider (root layout doesn't mount one),
  // so this island brings its own — same pattern as /hq/layout.tsx.
  return (
    <ToastProvider>
      <ClaimBannerInner {...props} />
    </ToastProvider>
  );
}
