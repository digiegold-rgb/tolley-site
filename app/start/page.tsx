import { CircleRouter } from "@/app/circle/circle-router";
import { EmailCaptureForm } from "@/components/tools/EmailCaptureForm";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { directoryByGroup, type DirectoryGroup, type DirectoryEntry } from "@/lib/directory";

export const metadata: Metadata = {
  alternates: { canonical: "https://www.tolley.io/start" },
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

const GROUP_LOOK: Record<DirectoryGroup, { emoji: string; color: string }> = {
  "Start a Business": { emoji: "🚀", color: "var(--tolley-accent)" },
  "Real Estate": { emoji: "🏡", color: "var(--tolley-accent)" },
  "Home Services": { emoji: "🧰", color: "var(--tolley-accent)" },
  Rentals: { emoji: "🧺", color: "var(--tolley-accent)" },
  "Hauling & Delivery": { emoji: "🚛", color: "var(--tolley-accent)" },
  "Shop & Food": { emoji: "🛍️", color: "var(--tolley-accent)" },
  "AI & Ventures": { emoji: "🤖", color: "var(--tolley-accent)" },
  Events: { emoji: "💍", color: "var(--tolley-accent)" },
};

function ServiceCard({ svc }: { svc: DirectoryEntry }) {
  return (
    <Link
      href={svc.url}
      className="tolley-service-card group flex flex-col items-center px-5 py-5 text-center transition-colors"
    >
      <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15">
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
            <Link href="/sales" className="tolley-button">
              🚀 Start a business
            </Link>
            <Link href="/agent" className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/40">
              🎯 For real-estate agents
            </Link>
          </div>
        </div>

        <section id="route" className="mb-10 w-full scroll-mt-8">
          <CircleRouter groups={groups.map(({ group, entries }) => ({ group, entries, ...GROUP_LOOK[group] }))} />
        </section>

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

        <section className="mt-10 w-full max-w-md text-center">
          <h2 className="text-lg font-bold text-white">Local deals and service updates</h2>
          <EmailCaptureForm source="circle" ctaText="Keep me updated"
            successMessage="You're on the list. Talk soon." className="mt-4" />
        </section>
        <p className="mt-4 text-xs text-neutral-600">
          &copy; {new Date().getFullYear()} tolley.io &middot; Independence, MO
        </p>
      </main>
    </div>
  );
}
