import type { Metadata } from "next";
import { LeadFollowUpAudit } from "@/components/tools/LeadFollowUpAudit";

export const metadata: Metadata = {
  title: "Lead Follow-Up Self Audit | T-Agent",
  description: "Score your lead follow-up strategy across 10 dimensions. Free 2-minute assessment for real estate agents — no email required.",
  openGraph: {
    title: "Lead Follow-Up Self Audit for Real Estate Agents",
    description: "How strong is your lead follow-up? Score yourself across 10 dimensions and get a personalized breakdown.",
    url: "https://tolley.io/tools/lead-follow-up-audit",
  },
};

export default function LeadFollowUpAuditPage() {
  return (
    <div className="mx-auto max-w-2xl px-5">
      <div className="mb-8 text-center">
        <p className="text-[0.7rem] tracking-[0.3em] text-violet-300/70 uppercase">Free Assessment</p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
          Lead Follow-Up Self Audit
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-white/55">
          10 questions. 2 minutes. Scored 0–100 across the dimensions that determine whether leads convert or disappear.
        </p>
      </div>
      <LeadFollowUpAudit />
    </div>
  );
}
