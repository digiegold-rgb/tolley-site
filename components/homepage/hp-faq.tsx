"use client";

import { useState } from "react";

const faqs = [
  {
    q: "What data sources does T-Agent use?",
    a: "T-Agent aggregates court records from 50+ states, social media profiles, property ownership history, tax liens, bankruptcy filings, and public vital records — all enriched and scored by AI.",
  },
  {
    q: "How does the motivation scoring work?",
    a: "Our AI analyzes dozens of signals — liens, foreclosure notices, ownership duration, life events, vacancy indicators — and produces a 0–100 score predicting likelihood to transact.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel through your billing portal at any time. No contracts, no cancellation fees.",
  },
  {
    q: "Does Premium include everything in Basic?",
    a: "Yes. Premium includes all Basic features plus higher agent limits, advanced tooling, and priority support with faster SLA.",
  },
  {
    q: "Is the data compliant?",
    a: "All data is sourced from public records and compliant databases. T-Agent follows TCPA guidelines for SMS and adheres to fair-use data access standards.",
  },
];

export function HpFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="relative z-10 mx-auto w-full max-w-4xl scroll-mt-24 px-5 py-16 sm:px-8">
      <div className="mb-10 text-center">
        <p className="text-[0.72rem] font-medium tracking-[0.42em] text-white/68 uppercase">
          FAQ
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[0.02em] text-white/95 sm:text-3xl">
          Common questions
        </h2>
      </div>

      <div className="space-y-3">
        {faqs.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={item.q}
              className={`rounded-2xl border transition-colors duration-300 ${
                isOpen
                  ? "border-violet-300/25 bg-violet-950/15"
                  : "border-white/12 bg-black/22"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-semibold text-white/90">{item.q}</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className={`shrink-0 text-white/50 transition-transform duration-300 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                >
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div
                className={`hp-accordion-body ${isOpen ? "hp-accordion-open" : ""}`}
              >
                <div>
                  <div className="px-5 pb-4">
                    <p className="text-sm leading-7 text-white/68">{item.a}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
