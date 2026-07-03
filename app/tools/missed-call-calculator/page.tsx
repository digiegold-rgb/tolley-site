import type { Metadata } from "next";
import { MissedCallCalculator } from "@/components/tools/MissedCallCalculator";

export const metadata: Metadata = {
  title: "Missed Call Revenue Calculator | T-Agent",
  description: "Find out exactly how much revenue you're losing to missed calls and voicemails every month. Free calculator for real estate agents.",
  openGraph: {
    title: "Missed Call Revenue Calculator for Real Estate Agents",
    description: "Calculate how much revenue you're losing to missed calls — and how AI follow-up changes the math.",
    url: "https://tolley.io/tools/missed-call-calculator",
  },
};

export default function MissedCallCalculatorPage() {
  return (
    <div className="mx-auto max-w-5xl px-5">
      {/* Hero */}
      <div className="mb-10 text-center">
        <p className="text-[0.7rem] tracking-[0.3em] text-violet-300/70 uppercase">Free Tool</p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
          Missed Call Revenue Calculator
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/55">
          NAR data shows the average agent misses 6–9 calls per week. Slide to your numbers and see the dollar cost — then see what AI follow-up recovers.
        </p>
      </div>

      <MissedCallCalculator />
    </div>
  );
}
