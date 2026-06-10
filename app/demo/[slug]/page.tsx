// /demo/[slug] — Engine 1's payload: a personalized one-page website preview
// for a scraped GrowthLead, sent in cold email ("I built your business a
// website preview — want it live? $500, this week, $49/mo after").
//
// Built ONLY from data we actually have: name, category, real Google rating
// + review count, phone, address. No stock "their business" photos, no
// fabricated testimonials. Category themes (lib/demo-site.ts) make an auto
// shop, a nail salon, and a lawn crew feel like different designers built
// them. The page IS the sales pitch.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Cormorant_Garamond, Fredoka, Inter, Oswald } from "next/font/google";

import { prisma } from "@/lib/prisma";
import {
  cityOrMetro,
  mapsEmbedUrl,
  mapsLinkUrl,
  phoneToE164,
  themeForCategory,
  type DemoTheme,
} from "@/lib/demo-site";
import { DemoIcon } from "@/components/demo/demo-icons";
import { DemoClaimBanner } from "@/components/demo/demo-claim-banner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inter = Inter({ subsets: ["latin"], variable: "--font-demo-sans" });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-demo-industrial" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-demo-serif",
});
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-demo-rounded" });

const DISPLAY_FONT_CLASS: Record<DemoTheme["font"], string> = {
  sans: "font-[family-name:var(--font-demo-sans)]",
  industrial: "font-[family-name:var(--font-demo-industrial)]",
  serif: "font-[family-name:var(--font-demo-serif)]",
  rounded: "font-[family-name:var(--font-demo-rounded)]",
};

// Tracking-feel per font family — condensed industrial wants a little air,
// the serif reads better tight.
const DISPLAY_TRACKING: Record<DemoTheme["font"], string> = {
  sans: "tracking-tight",
  industrial: "tracking-tight uppercase",
  serif: "tracking-[-0.01em]",
  rounded: "tracking-tight",
};

async function getLead(slug: string) {
  // Slugs are generated kebab-case by scripts/generate-demos.mjs; reject
  // anything else before it reaches the DB.
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  return prisma.growthLead.findFirst({
    where: { demoUrl: `/demo/${slug}` },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lead = await getLead(slug);
  if (!lead) {
    return { title: "Preview not found", robots: { index: false, follow: false } };
  }
  const theme = themeForCategory(lead.category);
  return {
    title: `${lead.name} — ${theme.label}${lead.city ? ` in ${lead.city}` : ""}`,
    description: `Website preview for ${lead.name}, built by Tolley Digital (Independence, MO).`,
    // Cold-outreach previews — never index these.
    robots: { index: false, follow: false },
  };
}

function Stars({ rating, color }: { rating: number; color: string }) {
  const full = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill={i < full ? color : "none"}
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.9L12 3.5Z" />
        </svg>
      ))}
    </span>
  );
}

function RatingBadge({
  rating,
  reviews,
  starColor,
  className,
}: {
  rating: number | null;
  reviews: number | null;
  starColor: string;
  className?: string;
}) {
  if (rating == null) return null;
  return (
    <div className={`inline-flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <Stars rating={rating} color={starColor} />
      <span className="text-sm font-semibold">
        {rating.toFixed(1)}★
        {reviews != null && reviews > 0 && (
          <span className="font-normal opacity-75">
            {" "}
            · {reviews.toLocaleString()} Google review{reviews === 1 ? "" : "s"}
          </span>
        )}
      </span>
    </div>
  );
}

export default async function DemoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lead = await getLead(slug);
  if (!lead) notFound();

  const theme = themeForCategory(lead.category);
  const city = cityOrMetro(lead.city);
  const tel = phoneToE164(lead.phone);
  const displayFont = DISPLAY_FONT_CLASS[theme.font];
  const displayTracking = DISPLAY_TRACKING[theme.font];
  const v = theme.vars;

  const styleVars = {
    "--d-bg": v.bg,
    "--d-bg2": v.bg2,
    "--d-surface": v.surface,
    "--d-ink": v.ink,
    "--d-ink-soft": v.inkSoft,
    "--d-accent": v.accent,
    "--d-accent-ink": v.accentInk,
    "--d-hero-bg": v.heroBg,
    "--d-hero-ink": v.heroInk,
    "--d-hero-soft": v.heroSoft,
    "--d-border": v.border,
  } as React.CSSProperties;

  return (
    <div
      style={styleVars}
      className={`${inter.variable} ${oswald.variable} ${cormorant.variable} ${fredoka.variable} min-h-screen bg-[var(--d-bg)] pb-32 font-[family-name:var(--font-demo-sans)] text-[var(--d-ink)] antialiased sm:pb-24`}
    >
      {/* ── Top bar ── */}
      <header className="border-b border-[var(--d-border)] bg-[var(--d-surface)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className={`truncate text-base font-bold leading-tight ${displayFont} ${displayTracking}`}>
              {lead.name}
            </p>
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-[var(--d-ink-soft)]">
              {theme.label}
              {lead.city ? ` · ${lead.city}` : ""}
            </p>
          </div>
          {tel && (
            <a
              href={`tel:${tel}`}
              className="flex shrink-0 items-center gap-2 rounded-full bg-[var(--d-accent)] px-4 py-2 text-sm font-semibold text-[var(--d-accent-ink)] shadow-sm transition hover:opacity-90"
            >
              <DemoIcon name="phone" className="h-4 w-4" />
              <span className="hidden sm:inline">{lead.phone}</span>
              <span className="sm:hidden">Call</span>
            </a>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        style={{ background: v.heroBg }}
        className="relative overflow-hidden"
      >
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
          <p
            className="mb-4 inline-block rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em]"
            style={{
              color: v.heroSoft,
              borderColor:
                theme.mood === "dark" ? "rgba(255,255,255,0.22)" : v.border,
            }}
          >
            {theme.eyebrow}
            {lead.city ? ` — ${lead.city}` : ""}
          </p>
          <h1
            className={`max-w-3xl text-4xl font-bold leading-[1.05] sm:text-6xl ${displayFont} ${displayTracking}`}
            style={{ color: v.heroInk }}
          >
            {theme.headline(lead.name, city)}
          </h1>
          <p
            className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg"
            style={{ color: v.heroSoft }}
          >
            {theme.sub(lead.name, city)}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {tel && (
              <a
                href={`tel:${tel}`}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--d-accent)] px-6 py-3 text-sm font-semibold text-[var(--d-accent-ink)] shadow-lg transition hover:opacity-90"
              >
                <DemoIcon name="phone" className="h-4 w-4" />
                {theme.ctaLabel} — {lead.phone}
              </a>
            )}
            <a
              href="#services"
              className="inline-flex items-center rounded-full border px-6 py-3 text-sm font-semibold transition hover:opacity-80"
              style={{
                color: v.heroInk,
                borderColor:
                  theme.mood === "dark" ? "rgba(255,255,255,0.28)" : v.border,
              }}
            >
              See what we do
            </a>
          </div>

          {lead.rating != null && (
            <div
              className="mt-8 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5"
              style={{
                color: v.heroInk,
                borderColor:
                  theme.mood === "dark" ? "rgba(255,255,255,0.18)" : v.border,
                background:
                  theme.mood === "dark"
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(255,255,255,0.6)",
              }}
            >
              <RatingBadge
                rating={lead.rating}
                reviews={lead.reviews}
                starColor={theme.mood === "dark" ? "#fbbf24" : v.star}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section className="border-b border-[var(--d-border)] bg-[var(--d-surface)]">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 py-6 sm:grid-cols-3 sm:px-6">
          {lead.rating != null && (
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--d-bg2)] text-[var(--d-accent)]">
                <DemoIcon name="star" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {lead.rating.toFixed(1)}★ on Google
                </p>
                <p className="text-xs text-[var(--d-ink-soft)]">
                  {lead.reviews != null && lead.reviews > 0
                    ? `${lead.reviews.toLocaleString()} real customer reviews`
                    : "Verified Google rating"}
                </p>
              </div>
            </div>
          )}
          {lead.address && (
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--d-bg2)] text-[var(--d-accent)]">
                <DemoIcon name="mappin" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {lead.city ? `Based in ${lead.city}` : "Local to the KC metro"}
                </p>
                <p className="text-xs text-[var(--d-ink-soft)]">{lead.address}</p>
              </div>
            </div>
          )}
          {tel && (
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--d-bg2)] text-[var(--d-accent)]">
                <DemoIcon name="phone" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Talk to a real person</p>
                <a
                  href={`tel:${tel}`}
                  className="text-xs font-medium text-[var(--d-accent)] underline-offset-2 hover:underline"
                >
                  {lead.phone}
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" className="bg-[var(--d-bg)]">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <h2
            className={`text-3xl font-bold sm:text-4xl ${displayFont} ${displayTracking}`}
          >
            {theme.servicesHeading}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--d-ink-soft)] sm:text-base">
            {theme.servicesIntro(city)}
          </p>
          <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {theme.services.map((s) => (
              <div
                key={s.title}
                className="group rounded-2xl border border-[var(--d-border)] bg-[var(--d-surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--d-bg2)] text-[var(--d-accent)] transition group-hover:scale-105">
                  <DemoIcon name={s.icon} className="h-6 w-6" />
                </span>
                <h3 className={`text-lg font-bold ${displayFont} ${displayTracking}`}>
                  {s.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--d-ink-soft)]">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Rating callout ── */}
      {lead.rating != null && lead.reviews != null && lead.reviews > 0 && (
        <section className="bg-[var(--d-bg2)]">
          <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 sm:py-16">
            <div className="mx-auto mb-4 flex justify-center">
              <Stars rating={lead.rating} color={v.star} />
            </div>
            <p className={`text-2xl font-bold sm:text-3xl ${displayFont} ${displayTracking}`}>
              {lead.rating.toFixed(1)} out of 5 — rated by{" "}
              {lead.reviews.toLocaleString()} customers on Google
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--d-ink-soft)]">
              That rating wasn&apos;t written by us — it&apos;s what real{" "}
              {city === "the KC metro" ? "KC" : city} customers said. Read the
              reviews, then call.
            </p>
          </div>
        </section>
      )}

      {/* ── Find us / contact ── */}
      <section className="bg-[var(--d-bg)]">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2">
          <div>
            <h2 className={`text-3xl font-bold sm:text-4xl ${displayFont} ${displayTracking}`}>
              Stop by or call ahead
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--d-ink-soft)] sm:text-base">
              {theme.finalLine(lead.name, city)}
            </p>
            <div className="mt-7 flex flex-col gap-4">
              {lead.address && (
                <a
                  href={mapsLinkUrl(lead.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--d-bg2)] text-[var(--d-accent)]">
                    <DemoIcon name="mappin" className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">Address</span>
                    <span className="block text-sm text-[var(--d-ink-soft)] underline-offset-2 hover:underline">
                      {lead.address}
                    </span>
                  </span>
                </a>
              )}
              {tel && (
                <a href={`tel:${tel}`} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--d-bg2)] text-[var(--d-accent)]">
                    <DemoIcon name="phone" className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">Phone</span>
                    <span className="block text-sm text-[var(--d-accent)]">
                      {lead.phone}
                    </span>
                  </span>
                </a>
              )}
            </div>
            {tel && (
              <a
                href={`tel:${tel}`}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--d-accent)] px-6 py-3 text-sm font-semibold text-[var(--d-accent-ink)] shadow-lg transition hover:opacity-90"
              >
                <DemoIcon name="phone" className="h-4 w-4" />
                {theme.ctaLabel}
              </a>
            )}
          </div>
          {lead.address && (
            <div className="overflow-hidden rounded-2xl border border-[var(--d-border)] shadow-sm">
              <iframe
                title={`Map to ${lead.name}`}
                src={mapsEmbedUrl(`${lead.name}, ${lead.address}`)}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-72 w-full border-0 sm:h-full sm:min-h-80"
              />
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--d-border)] bg-[var(--d-surface)]">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1.5 px-4 py-8 text-center sm:px-6">
          <p className={`text-base font-bold ${displayFont} ${displayTracking}`}>
            {lead.name}
          </p>
          <p className="text-xs text-[var(--d-ink-soft)]">
            {[lead.address, lead.phone].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-3 text-[0.68rem] uppercase tracking-[0.18em] text-[var(--d-ink-soft)] opacity-70">
            Website preview by Tolley Digital · Independence, MO
          </p>
        </div>
      </footer>

      <DemoClaimBanner slug={slug} businessName={lead.name} />
    </div>
  );
}
