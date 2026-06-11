// /v/[slug] — the B2B "I made you a video" watch page. A scraped GrowthLead
// (offer=video) gets a 15-second promo rendered by scripts/generate-lead-videos.ts
// and hosted on Vercel Blob (lead.videoAssetUrl); this page is the link that
// goes in the cold email. Dark cinematic layout — the video IS the pitch, the
// CTA is the close: $250 one-time, $99/mo keeps fresh videos coming.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { DEMO_TOLLEY_PHONE, DEMO_TOLLEY_PHONE_TEL } from "@/lib/demo-site";
import { VideoBuyButton } from "@/components/video/video-buy-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getLead(slug: string) {
  // Slugs are generated kebab-case by scripts/generate-lead-videos.ts; reject
  // anything else before it reaches the DB.
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  return prisma.growthLead.findFirst({
    where: { videoUrl: `/v/${slug}` },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lead = await getLead(slug);
  if (!lead || !lead.videoAssetUrl) {
    return { title: "Video not found", robots: { index: false, follow: false } };
  }
  return {
    title: `A video for ${lead.name} — Tolley Digital`,
    description: `We made ${lead.name} a 15-second promo video from their real business info.`,
    // Cold-outreach assets — never index these.
    robots: { index: false, follow: false },
  };
}

const VALUE_BULLETS = [
  {
    title: "Runs everywhere",
    desc: "Facebook, Instagram, your Google Business profile, your website — one file, post it anywhere.",
  },
  {
    title: "Made from your real business",
    desc: "Your name, your reviews, your city. No stock footage pretending to be you.",
  },
  {
    title: "Yours this week",
    desc: "Pay once and the file is yours — we deliver the final cut within the week.",
  },
];

export default async function VideoWatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lead = await getLead(slug);
  if (!lead || !lead.videoAssetUrl) notFound();

  return (
    <div className="min-h-screen bg-[#0c0f14] text-white antialiased">
      {/* ── Top bar ── */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <p className="text-sm font-semibold tracking-tight text-white/90">
            Tolley Digital
            <span className="ml-2 hidden text-xs font-normal text-white/45 sm:inline">
              Independence, MO
            </span>
          </p>
          <a
            href={DEMO_TOLLEY_PHONE_TEL}
            className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-white transition hover:border-white/35 hover:bg-white/5"
          >
            Call {DEMO_TOLLEY_PHONE}
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
        {/* ── Hero: the video ── */}
        <section className="pt-10 text-center sm:pt-14">
          <p className="mb-3 inline-block rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-amber-300">
            Made for {lead.city ? `${lead.city}'s` : "your"}{" "}
            {(lead.category || "business").toLowerCase()}
          </p>
          <h1 className="mx-auto max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            We made this for {lead.name}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
            A 15-second promo built from your real business info
            {lead.rating != null
              ? ` — including your ${lead.rating.toFixed(1)}★ Google rating`
              : ""}
            . Watch it, then make it yours.
          </p>

          <div className="mx-auto mt-8 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/60">
            <video
              controls
              autoPlay
              muted
              loop
              playsInline
              src={lead.videoAssetUrl}
              className="aspect-video w-full"
            />
          </div>
        </section>

        {/* ── Value bullets ── */}
        <section className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {VALUE_BULLETS.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-white/10 bg-[#101319] p-5"
            >
              <h2 className="text-sm font-semibold text-white">{b.title}</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-white/55">
                {b.desc}
              </p>
            </div>
          ))}
        </section>

        {/* ── CTA ── */}
        <section className="mt-12 rounded-2xl border border-amber-400/20 bg-gradient-to-b from-amber-400/10 to-transparent p-8 text-center sm:p-10">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Like it? It&apos;s yours.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/65">
            One payment, full rights, final cut delivered this week — ready to
            post wherever your customers are.
          </p>
          <div className="mt-7 flex justify-center">
            <VideoBuyButton slug={slug} />
          </div>
          <p className="mx-auto mt-5 max-w-sm text-xs leading-relaxed text-white/45">
            $99/mo keeps 2 fresh videos coming every month — cancel anytime.
          </p>
          <p className="mt-4 text-xs text-white/40">
            Questions? Call or text{" "}
            <a
              href={DEMO_TOLLEY_PHONE_TEL}
              className="font-medium text-amber-400 underline underline-offset-2"
            >
              {DEMO_TOLLEY_PHONE}
            </a>
          </p>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-4xl px-4 py-8 text-center sm:px-6">
          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-white/35">
            Video by Tolley Digital · Independence, MO
          </p>
        </div>
      </footer>
    </div>
  );
}
