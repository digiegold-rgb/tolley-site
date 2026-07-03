import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Tools for Real Estate Agents | T-Agent",
  description: "Free calculators and assessments for real estate agents. Score your follow-up strategy, calculate missed call revenue, and audit your digital presence.",
};

const TOOLS = [
  {
    href: "/tools/missed-call-calculator",
    emoji: "💸",
    title: "Missed Call Revenue Calculator",
    desc: "See the dollar cost of missed calls — and what T-Agent recovers.",
    time: "1 min",
    cta: "Calculate",
  },
  {
    href: "/tools/lead-follow-up-audit",
    emoji: "📋",
    title: "Lead Follow-Up Self Audit",
    desc: "Score your follow-up strategy across 10 dimensions. Instant results.",
    time: "2 min",
    cta: "Take the Audit",
  },
  {
    href: "/tools/phone-presence-audit",
    emoji: "📞",
    title: "Phone Presence Audit",
    desc: "Rate your inbound call experience across 5 competency areas.",
    time: "3 min",
    cta: "Audit My Phone",
  },
  {
    href: "/tools/digital-presence-audit",
    emoji: "🌐",
    title: "Digital Presence Audit",
    desc: "Grade your Google Business Profile, Zillow, website, social, and reviews.",
    time: "3 min",
    cta: "Audit My Presence",
  },
];

export default function ToolsIndexPage() {
  return (
    <div className="mx-auto max-w-4xl px-5">
      <div className="mb-12 text-center">
        <p className="text-[0.7rem] tracking-[0.3em] text-violet-300/70 uppercase">Free Resources</p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
          Free Tools for Real Estate Agents
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-white/55">
          No login. No email. No catch. Use these tools to find where your business is leaking revenue — and what to do about it.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group rounded-3xl border border-white/12 bg-black/28 p-7 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/22 hover:bg-black/35"
          >
            <div className="text-3xl mb-4">{tool.emoji}</div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-white/90">{tool.title}</h2>
              <span className="shrink-0 text-xs text-white/35 mt-0.5">{tool.time}</span>
            </div>
            <p className="mt-2 text-sm text-white/50 leading-6">{tool.desc}</p>
            <div className="mt-5 flex items-center gap-2">
              <span className="text-xs font-semibold tracking-[0.1em] text-violet-300/80 uppercase group-hover:text-violet-200 transition">
                {tool.cta} →
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-7 text-center">
        <p className="text-sm text-white/50">
          Ready to automate what you&apos;ve identified? T-Agent starts at $49/mo.
        </p>
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/leads/pricing"
            className="rounded-full border border-violet-200/45 bg-violet-300/20 px-8 py-3 text-xs font-semibold tracking-[0.1em] text-violet-50 uppercase shadow-[0_0_20px_rgba(139,92,246,0.15)] transition hover:bg-violet-300/28"
          >
            See Plans — 7-Day Free Trial
          </Link>
          <Link
            href="/leads/demo"
            className="rounded-full border border-white/15 bg-white/[0.04] px-8 py-3 text-xs font-semibold tracking-[0.1em] text-white/70 uppercase transition hover:bg-white/[0.08]"
          >
            View the Demo
          </Link>
        </div>
      </div>
    </div>
  );
}
