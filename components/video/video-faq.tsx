"use client";

import { useState } from "react";
import { VIDEO_FAQ } from "@/lib/video";

export function VideoFaq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section>
      <h2 className="text-center text-3xl font-black tracking-tight text-white uppercase sm:text-4xl">
        FAQ
      </h2>

      <div className="mx-auto mt-10 max-w-3xl space-y-3">
        {VIDEO_FAQ.map((item, i) => (
          <div key={i} className="rounded-xl border border-purple-400/15 bg-purple-400/[0.04]">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <span className="pr-4 text-sm font-bold text-white">{item.q}</span>
              <svg
                className={`h-5 w-5 shrink-0 text-purple-400 transition-transform ${open === i ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {open === i && (
              <div className="border-t border-purple-400/10 px-5 pb-4 pt-3">
                <p className="text-sm leading-relaxed text-slate-400">{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
