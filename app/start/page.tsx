import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteTracker } from "@/components/analytics/site-tracker";
import { directoryByGroup, type DirectoryEntry } from "@/lib/directory";

export const metadata: Metadata = {
  title: "tolley.io | All Services",
  description:
    "Real estate, rentals, home services, hauling, delivery, AI tools, and a way to start your own business — all from tolley.io in Kansas City.",
  openGraph: {
    title: "tolley.io — All Services",
    description: "Everything you need. One link.",
    url: "https://www.tolley.io/start",
    type: "website",
  },
};

// Tailwind can't see runtime-built class strings, so map accent stems to the
// static classes we actually use. Any unknown accent falls back to neutral.
const ACCENT: Record<string, { border: string; bg: string; glow: string; ring: string }> = {
  sky: { border: "border-sky-500/25", bg: "bg-sky-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(14,165,233,0.35)]", ring: "ring-sky-500/40" },
  cyan: { border: "border-cyan-500/25", bg: "bg-cyan-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(6,182,212,0.35)]", ring: "ring-cyan-500/40" },
  teal: { border: "border-teal-500/25", bg: "bg-teal-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(20,184,166,0.35)]", ring: "ring-teal-500/40" },
  blue: { border: "border-blue-500/25", bg: "bg-blue-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(59,130,246,0.35)]", ring: "ring-blue-500/40" },
  amber: { border: "border-amber-500/25", bg: "bg-amber-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(245,158,11,0.35)]", ring: "ring-amber-500/40" },
  yellow: { border: "border-yellow-500/25", bg: "bg-yellow-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(234,179,8,0.35)]", ring: "ring-yellow-500/40" },
  orange: { border: "border-orange-500/25", bg: "bg-orange-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(232,93,4,0.35)]", ring: "ring-orange-500/40" },
  red: { border: "border-red-500/25", bg: "bg-red-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(239,68,68,0.35)]", ring: "ring-red-500/40" },
  green: { border: "border-green-500/25", bg: "bg-green-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(34,197,94,0.35)]", ring: "ring-green-500/40" },
  emerald: { border: "border-emerald-500/25", bg: "bg-emerald-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(16,185,129,0.35)]", ring: "ring-emerald-500/40" },
  purple: { border: "border-purple-500/25", bg: "bg-purple-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(168,85,247,0.35)]", ring: "ring-purple-500/40" },
  violet: { border: "border-violet-500/25", bg: "bg-violet-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(139,92,246,0.35)]", ring: "ring-violet-500/40" },
  indigo: { border: "border-indigo-500/25", bg: "bg-indigo-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(99,102,241,0.35)]", ring: "ring-indigo-500/40" },
  pink: { border: "border-pink-500/25", bg: "bg-pink-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(236,72,153,0.35)]", ring: "ring-pink-500/40" },
  rose: { border: "border-rose-500/25", bg: "bg-rose-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(244,63,94,0.35)]", ring: "ring-rose-500/40" },
  stone: { border: "border-stone-500/25", bg: "bg-stone-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(120,113,108,0.35)]", ring: "ring-stone-500/40" },
  slate: { border: "border-slate-500/25", bg: "bg-slate-500/[0.06]", glow: "hover:shadow-[0_0_28px_rgba(100,116,139,0.35)]", ring: "ring-slate-500/40" },
};
const NEUTRAL = { border: "border-white/10", bg: "bg-white/[0.04]", glow: "hover:shadow-[0_0_28px_rgba(255,255,255,0.14)]", ring: "ring-white/30" };

function ServiceCard({ svc }: { svc: DirectoryEntry }) {
  const a = ACCENT[svc.accent] ?? NEUTRAL;
  return (
    <Link
      href={svc.url}
      className={`group flex flex-col items-center rounded-2xl border ${a.border} ${a.bg} px-5 py-5 text-center transition-all duration-200 hover:-translate-y-1 ${a.glow}`}
    >
      <div className={`relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 shadow-lg ring-1 ${a.ring}`}>
        {svc.image ? (
          <Image src={svc.image} alt={svc.title} fill className="object-cover" sizes="56px" />
        ) : (
          <span className="text-2xl" aria-hidden="true">{svc.emoji}</span>
        )}
      </div>
      <p className="mt-3 text-lg font-bold tracking-wide text-white">{svc.title}</p>
      <p className="mt-1 text-xs text-neutral-400">{svc.tagline}</p>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-2 gap-y-1">
        {svc.bullets.map((b) => (
          <li key={b} className="text-xs text-neutral-400">
            <span className="mr-1 text-neutral-600">&bull;</span>
            {b}
          </li>
        ))}
      </ul>
      <svg
        className="mt-3 h-4 w-4 text-neutral-600 transition group-hover:translate-x-1 group-hover:text-white"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

export default function StartPage() {
  const groups = directoryByGroup();
  return (
    <div className="start-page">
      <SiteTracker site="start" />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center px-5 py-10 sm:py-14">
        {/* Hero */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Everything Tolley.io does. One place.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-400">
            Real estate, rentals, home services, hauling, delivery, AI tools — and a way to
            start your own business. All local to Kansas City.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/sales" className="rounded-full bg-orange-500 px-5 py-2 text-sm font-bold text-black transition hover:bg-orange-400">
              🚀 Start a business
            </Link>
            <Link href="/leads" className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/40">
              🎯 For real-estate agents
            </Link>
          </div>
        </div>

        {/* Sections */}
        <div className="flex w-full flex-col gap-10">
          {groups.map(({ group, entries }) => (
            <div key={group}>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex-shrink-0 text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">
                  {group}
                </span>
                <div className="h-px flex-1 bg-neutral-800" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map((svc) => (
                  <ServiceCard key={svc.name} svc={svc} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/circle"
          className="mt-10 text-xs font-semibold text-purple-400 transition hover:text-purple-300"
        >
          See how it all connects &rarr; the Circle
        </Link>
        <p className="mt-4 text-xs text-neutral-600">
          &copy; {new Date().getFullYear()} tolley.io &middot; Independence, MO
        </p>
      </main>
    </div>
  );
}
