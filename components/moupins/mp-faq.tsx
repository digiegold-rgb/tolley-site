"use client";

import { useState } from "react";

type FaqItem = {
  readonly q: string;
  readonly a: string;
};

export function MpFaq({ faqs }: { faqs: readonly FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {faqs.map((faq, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={faq.q}
            className={`rounded-2xl border transition-colors duration-300 ${
              isOpen
                ? "border-green-500/20 bg-green-950/15"
                : "border-white/8 bg-white/[0.02]"
            }`}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <span className="text-sm font-semibold text-white/80">
                {faq.q}
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className={`shrink-0 text-green-400/50 transition-transform duration-300 ${
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
            <div className={`mp-accordion-body ${isOpen ? "mp-accordion-open" : ""}`}>
              <div>
                <div className="px-5 pb-4">
                  <p className="text-sm leading-7 text-white/50">{faq.a}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
