import type { Metadata } from "next";
import { PhonePresenceAudit } from "@/components/tools/PhonePresenceAudit";

export const metadata: Metadata = {
  title: "Phone Presence Audit | T-Agent",
  description: "Score your inbound call experience across 5 competency areas. Free 10-minute assessment for real estate agents.",
  openGraph: {
    title: "Phone Presence Audit for Real Estate Agents",
    description: "How strong is your phone presence? Score yourself across Availability, Voicemail, Speed to Response, Lead Qualification, and Revenue Awareness.",
    url: "https://tolley.io/tools/phone-presence-audit",
  },
};

export default function PhonePresenceAuditPage() {
  return (
    <div className="mx-auto max-w-2xl px-5">
      <div className="mb-8 text-center">
        <p className="text-[0.7rem] tracking-[0.3em] text-violet-300/70 uppercase">Free Assessment</p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
          Phone Presence Audit
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-white/55">
          10 questions across 5 competency areas. Discover where calls are leaking revenue and what to fix first.
        </p>
      </div>
      <PhonePresenceAudit />
    </div>
  );
}
