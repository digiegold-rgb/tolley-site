import type { Metadata } from "next";
import Link from "next/link";
import { SiteTracker } from "@/components/analytics/site-tracker";
import { EmailCaptureForm } from "@/components/tools/EmailCaptureForm";
import { directoryByGroup, type DirectoryGroup } from "@/lib/directory";
import { getCircleStats } from "@/lib/circle-stats";
import { CircleFlywheel, type FlywheelGroup } from "./circle-flywheel";
import { CircleRouter } from "./circle-router";

export const metadata: Metadata = {
  title: "The Tolley Circle | one link, the whole network",
  description:
    "One hook, one link, every service: real estate, rentals, home services, hauling, delivery, shop, food, and AI tools — all connected through one Kansas City hub.",
  openGraph: {
    title: "The Tolley Circle",
    description: "One link. The whole network. See how it all connects.",
    url: "https://www.tolley.io/circle",
    type: "website",
  },
};

// Revalidate with the stats cache so the flywheel numbers stay fresh.
export const revalidate = 900;

const GROUP_LOOK: Record<DirectoryGroup, { emoji: string; color: string }> = {
  "Start a Business": { emoji: "🚀", color: "#f97316" },
  "Real Estate": { emoji: "🏡", color: "#0ea5e9" },
  "Home Services": { emoji: "🧰", color: "#06b6d4" },
  Rentals: { emoji: "🧺", color: "#3b82f6" },
  "Hauling & Delivery": { emoji: "🚛", color: "#ef4444" },
  "Shop & Food": { emoji: "🛍️", color: "#ec4899" },
  "AI & Ventures": { emoji: "🤖", color: "#8b5cf6" },
  Events: { emoji: "💍", color: "#f43f5e" },
};

const STAGES = [
  { n: "1", title: "Hook", body: "Millions of views a year on social. Every post carries one link: this page." },
  { n: "2", title: "Capture", body: "You say what you need — right here. Your info lands on Jared's desk, not in a void." },
  { n: "3", title: "Route", body: "The circle sends you to the exact live service — no hunting, no phone tag." },
  { n: "4", title: "Serve", body: "Real service, real person, fair price. Book it, rent it, buy it — done same-day where possible." },
  { n: "5", title: "Return", body: "You're in the circle now. Next time you need anything — homes to hauling — you already know the link." },
];

export default async function CirclePage() {
  const stats = await getCircleStats().catch(() => null);
  const statsByGroup = new Map(stats?.groups.map((g) => [g.group, g]) ?? []);

  const flywheelGroups: FlywheelGroup[] = directoryByGroup().map(({ group, entries }) => ({
    group,
    emoji: GROUP_LOOK[group].emoji,
    color: GROUP_LOOK[group].color,
    visits30d: statsByGroup.get(group)?.visits30d ?? 0,
    leads30d: statsByGroup.get(group)?.leads30d ?? 0,
    entries: entries.map((e) => ({
      name: e.name,
      url: e.url,
      title: e.title,
      tagline: e.tagline,
      emoji: e.emoji,
    })),
  }));

  const topSources = stats?.totals.topSources.slice(0, 3).map((s) => s.source) ?? [];

  return (
    <div className="circle-page">
      <SiteTracker site="circle" />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center px-5 py-10 sm:py-14">
        {/* Hero */}
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-400">
            tolley.io/circle
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-5xl">
            The Circle
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-400 sm:text-base">
            One hook. One link. The whole network — real estate, rentals, home services,
            hauling, shop, food, and AI — spinning around one hub. These numbers are live.
          </p>
          {topSources.length > 0 && (
            <p className="mx-auto mt-2 max-w-xl text-xs text-neutral-500">
              People arrive here from {topSources.join(", ")} — and leave with exactly what they came for.
            </p>
          )}
        </div>

        {/* The live flywheel */}
        <CircleFlywheel
          groups={flywheelGroups}
          totalVisits={stats?.totals.visits30d ?? 0}
          totalLeads={stats?.totals.leads30d ?? 0}
        />

        {/* How the loop runs */}
        <div className="mt-14 w-full">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex-shrink-0 text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">
              How the circle runs
            </span>
            <div className="h-px flex-1 bg-neutral-800" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            {STAGES.map((s) => (
              <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <p className="text-xs font-black text-purple-400">{s.n} · {s.title.toUpperCase()}</p>
                <p className="mt-2 text-xs leading-relaxed text-neutral-400">{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* The router — the capture moment */}
        <div className="mt-14 w-full" id="route">
          <CircleRouter groups={flywheelGroups} />
        </div>

        {/* Join the circle */}
        <div className="mt-14 w-full rounded-3xl border border-purple-500/25 bg-purple-500/[0.06] p-6 text-center sm:p-8">
          <h2 className="text-2xl font-black text-white">Join the Circle</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-neutral-400">
            Not ready to pick? Drop your email and stay in orbit — new services, local KC deals,
            and first shot at whatever launches next.
          </p>
          <EmailCaptureForm
            source="circle"
            ctaText="Keep me in the circle"
            successMessage="You're in the circle. Talk soon."
            className="mx-auto mt-5 max-w-md"
          />
        </div>

        {/* Exit CTAs */}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/start" className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/40">
            Browse everything →
          </Link>
          <Link href="/sales" className="rounded-full bg-orange-500 px-5 py-2 text-sm font-bold text-black transition hover:bg-orange-400">
            🚀 Run your own spoke
          </Link>
        </div>

        <p className="mt-10 text-xs text-neutral-600">
          &copy; {new Date().getFullYear()} tolley.io &middot; Independence, MO
        </p>
      </main>
    </div>
  );
}
