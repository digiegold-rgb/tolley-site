"use client";

import { EmailCaptureForm } from "@/components/tools/EmailCaptureForm";

export function HpNewsletter() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      <div className="rounded-3xl border border-white/15 bg-black/28 px-8 py-10 backdrop-blur-xl text-center sm:px-12">
        <p className="text-[0.65rem] tracking-[0.3em] text-violet-300/65 uppercase">Weekly Intel</p>
        <h2 className="mt-3 text-xl font-semibold text-white/95 sm:text-2xl">
          The T-Agent Weekly
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/55">
          KC market data, motivated seller signals, AI follow-up tips, and one actionable tactic every Friday.
          No fluff. No spam. Unsubscribe anytime.
        </p>
        <div className="mt-6 mx-auto max-w-md">
          <EmailCaptureForm
            source="newsletter"
            placeholder="your@email.com"
            ctaText="Subscribe Free"
            successMessage="You're in. First issue arrives this Friday."
          />
        </div>
        <p className="mt-3 text-xs text-white/30">Join real estate agents getting smarter every week.</p>
      </div>
    </section>
  );
}
