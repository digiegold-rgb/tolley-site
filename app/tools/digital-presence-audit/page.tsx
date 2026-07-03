import type { Metadata } from "next";
import { DigitalPresenceAudit } from "@/components/tools/DigitalPresenceAudit";

export const metadata: Metadata = {
  title: "Digital Presence Audit | T-Agent",
  description: "Score your online presence across 6 channels. Free 3-minute assessment for real estate agents — instant results, no email required.",
  openGraph: {
    title: "Digital Presence Audit for Real Estate Agents",
    description: "Grade your Google Business Profile, Zillow, website, social media, reviews, and phone presence.",
    url: "https://tolley.io/tools/digital-presence-audit",
  },
};

export default function DigitalPresenceAuditPage() {
  return (
    <div className="mx-auto max-w-2xl px-5">
      <div className="mb-8 text-center">
        <p className="text-[0.7rem] tracking-[0.3em] text-violet-300/70 uppercase">Free Assessment</p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
          Digital Presence Audit
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-white/55">
          Score yourself across 6 channels in 3 minutes. See where buyers and sellers are finding gaps before you do.
        </p>
      </div>
      <DigitalPresenceAudit />
    </div>
  );
}
