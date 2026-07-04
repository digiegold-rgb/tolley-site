// /biz/[slug] — a Launchpad operator's public storefront.
//
// Provisioned instantly from the Work Order form (a pending Operator + a
// published, selling-disabled Storefront). The BODY is themed per trade via
// lib/demo-site.ts so each operator's page feels custom-built. The Launchpad
// framing (top ribbon, fresh banner, Buy state, "Powered by" footer) is the v2
// charcoal/safety-orange brand, styled from app/biz/biz.css. Buy buttons stay
// locked until Jared flips sellingEnabled (the handshake).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Cormorant_Garamond, Fredoka, Inter, Oswald } from "next/font/google";

import { prisma } from "@/lib/prisma";
import {
  cityOrMetro,
  phoneToE164,
  themeForKey,
  type DemoTheme,
} from "@/lib/demo-site";
import { parseOfferings, formatOfferingPrice } from "@/lib/launchpad";
import { DemoIcon } from "@/components/demo/demo-icons";
import { BuyButton } from "@/components/launchpad/buy-button";
import "../biz.css";

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

const DISPLAY_TRACKING: Record<DemoTheme["font"], string> = {
  sans: "tracking-tight",
  industrial: "tracking-tight uppercase",
  serif: "tracking-[-0.01em]",
  rounded: "tracking-tight",
};

async function getStorefront(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  return prisma.storefront.findUnique({
    where: { slug },
    select: {
      slug: true,
      businessName: true,
      category: true,
      tagline: true,
      about: true,
      city: true,
      phone: true,
      offerings: true,
      published: true,
      sellingEnabled: true,
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sf = await getStorefront(slug);
  if (!sf || !sf.published) {
    return { title: "Storefront not found", robots: { index: false, follow: false } };
  }
  const theme = themeForKey(sf.category);
  const title = `${sf.businessName} — ${theme.label}${sf.city ? ` in ${sf.city}` : ""}`;
  const description =
    sf.tagline?.trim() ||
    `${sf.businessName} — ${theme.label.toLowerCase()}${sf.city ? ` in ${sf.city}` : ""}, powered by The Launchpad at tolley.io.`;
  const ogImg = `/biz/${slug}/opengraph-image`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImg, width: 1200, height: 630, alt: sf.businessName }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImg] },
  };
}

export default async function StorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fresh?: string; checkout?: string; purchased?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const sf = await getStorefront(slug);
  if (!sf || !sf.published) notFound();

  const theme = themeForKey(sf.category);
  const city = cityOrMetro(sf.city);
  const tel = phoneToE164(sf.phone);
  const displayFont = DISPLAY_FONT_CLASS[theme.font];
  const displayTracking = DISPLAY_TRACKING[theme.font];
  const v = theme.vars;
  const offerings = parseOfferings(sf.offerings);
  const isFresh = sp.fresh === "1";

  const headline = sf.tagline?.trim() || theme.headline(sf.businessName, city);
  const about = sf.about?.trim() || theme.sub(sf.businessName, city);

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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: sf.businessName,
    ...(sf.about ? { description: sf.about } : {}),
    ...(sf.city ? { areaServed: sf.city } : {}),
    ...(sf.phone ? { telephone: sf.phone } : {}),
    url: `https://www.tolley.io/biz/${slug}`,
    ...(offerings.length
      ? {
          makesOffer: offerings.map((o) => ({
            "@type": "Offer",
            name: o.name,
            ...(o.priceCents > 0
              ? { price: (o.priceCents / 100).toFixed(2), priceCurrency: "USD" }
              : {}),
          })),
        }
      : {}),
  };

  return (
    <div
      className={`biz-chrome ${inter.variable} ${oswald.variable} ${cormorant.variable} ${fredoka.variable}`}
    >
      <script
        type="application/ld+json"
        // JSON.stringify already escapes quotes; replace `<` so operator-supplied
        // text (business name, about) can never break out of the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* ── Launchpad ribbon ── */}
      <div className="biz-ribbon">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-1.5 text-[0.7rem] sm:px-6">
          <span>
            <span className="biz-ribbon-brand">The Launchpad</span>{" "}
            <span className="biz-ribbon-dot">·</span> a Tolley.io business
          </span>
          <a href="/sales">Start yours →</a>
        </div>
      </div>

      {/* ── Fresh-site banner ── */}
      {isFresh && (
        <div className="biz-fresh">
          <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-6">
            <span className="biz-fresh-badge inline-flex w-fit items-center rounded-full px-3 py-1 text-xs">
              Your site exists.
            </span>
            <span className="biz-fresh-sub text-sm">
              This is your storefront — live right now. Jared will text you to turn on
              ordering and set your prices.
            </span>
          </div>
        </div>
      )}

      {/* ── Themed storefront body ── */}
      <div
        style={styleVars}
        className="min-h-screen bg-[var(--d-bg)] pb-16 font-[family-name:var(--font-demo-sans)] text-[var(--d-ink)] antialiased"
      >
        {/* Header */}
        <header className="border-b border-[var(--d-border)] bg-[var(--d-surface)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className={`truncate text-base font-bold leading-tight ${displayFont} ${displayTracking}`}>
                {sf.businessName}
              </p>
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-[var(--d-ink-soft)]">
                {theme.label}
                {sf.city ? ` · ${sf.city}` : ""}
              </p>
            </div>
            {tel && (
              <a
                href={`tel:${tel}`}
                className="flex shrink-0 items-center gap-2 rounded-full bg-[var(--d-accent)] px-4 py-2 text-sm font-semibold text-[var(--d-accent-ink)] shadow-sm transition hover:opacity-90"
              >
                <DemoIcon name="phone" className="h-4 w-4" />
                <span className="hidden sm:inline">{sf.phone}</span>
                <span className="sm:hidden">Call</span>
              </a>
            )}
          </div>
        </header>

        {/* Hero */}
        <section style={{ background: v.heroBg }} className="relative overflow-hidden">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
            <p
              className="mb-4 inline-block rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em]"
              style={{
                color: v.heroSoft,
                borderColor: theme.mood === "dark" ? "rgba(255,255,255,0.22)" : v.border,
              }}
            >
              {theme.eyebrow}
              {sf.city ? ` — ${sf.city}` : ""}
            </p>
            <h1
              className={`max-w-3xl text-4xl font-bold leading-[1.05] sm:text-6xl ${displayFont} ${displayTracking}`}
              style={{ color: v.heroInk }}
            >
              {headline}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: v.heroSoft }}>
              {about}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#offerings"
                className="inline-flex items-center rounded-full bg-[var(--d-accent)] px-6 py-3 text-sm font-semibold text-[var(--d-accent-ink)] shadow-lg transition hover:opacity-90"
              >
                See what we offer
              </a>
              {tel && (
                <a
                  href={`tel:${tel}`}
                  className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition hover:opacity-80"
                  style={{
                    color: v.heroInk,
                    borderColor: theme.mood === "dark" ? "rgba(255,255,255,0.28)" : v.border,
                  }}
                >
                  <DemoIcon name="phone" className="h-4 w-4" />
                  {sf.phone}
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Offerings */}
        <section id="offerings" className="bg-[var(--d-bg)]">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
            <h2 className={`text-3xl font-bold sm:text-4xl ${displayFont} ${displayTracking}`}>
              {theme.servicesHeading}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--d-ink-soft)] sm:text-base">
              {theme.servicesIntro(city)}
            </p>
            <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offerings.map((o) => {
                const priceLabel = formatOfferingPrice(o);
                const priced = o.priceCents > 0;
                return (
                  <div
                    key={o.name}
                    className="flex flex-col rounded-2xl border border-[var(--d-border)] bg-[var(--d-surface)] p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className={`text-lg font-bold ${displayFont} ${displayTracking}`}>
                        {o.name}
                      </h3>
                      {priced && (
                        <span className="shrink-0 rounded-full bg-[var(--d-bg2)] px-3 py-1 text-sm font-bold text-[var(--d-accent)]">
                          {priceLabel}
                        </span>
                      )}
                    </div>
                    {o.desc && (
                      <p className="mt-1.5 text-sm leading-relaxed text-[var(--d-ink-soft)]">
                        {o.desc}
                      </p>
                    )}
                    <div className="mt-auto">
                      {priced ? (
                        <BuyButton
                          slug={sf.slug}
                          offering={o.name}
                          priceLabel={priceLabel}
                          sellingEnabled={sf.sellingEnabled}
                          phone={sf.phone}
                        />
                      ) : (
                        <p className="mt-4 text-xs text-[var(--d-ink-soft)]">
                          {tel ? (
                            <>
                              Text{" "}
                              <a href={`sms:${tel}`} className="font-semibold text-[var(--d-accent)] underline underline-offset-2">
                                {sf.phone}
                              </a>{" "}
                              to order.
                            </>
                          ) : (
                            "Pricing coming soon."
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Contact */}
        {tel && (
          <section className="bg-[var(--d-bg2)]">
            <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 sm:py-16">
              <h2 className={`text-2xl font-bold sm:text-3xl ${displayFont} ${displayTracking}`}>
                {theme.finalLine(sf.businessName, city)}
              </h2>
              <a
                href={`tel:${tel}`}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--d-accent)] px-6 py-3 text-sm font-semibold text-[var(--d-accent-ink)] shadow-lg transition hover:opacity-90"
              >
                <DemoIcon name="phone" className="h-4 w-4" />
                {theme.ctaLabel} — {sf.phone}
              </a>
            </div>
          </section>
        )}

        {/* Storefront footer */}
        <footer className="border-t border-[var(--d-border)] bg-[var(--d-surface)]">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-1.5 px-4 py-8 text-center sm:px-6">
            <p className={`text-base font-bold ${displayFont} ${displayTracking}`}>
              {sf.businessName}
            </p>
            <p className="text-xs text-[var(--d-ink-soft)]">
              {[sf.city, sf.phone].filter(Boolean).join(" · ")}
            </p>
          </div>
        </footer>
      </div>

      {/* ── Powered-by (the viral loop) ── */}
      <div className="biz-poweredby">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 px-4 py-6 text-center text-xs sm:px-6">
          <p>
            Powered by <a href="/sales">The Launchpad</a> @ tolley.io — start a business
            with no license, no bank, no money.
          </p>
        </div>
      </div>
    </div>
  );
}
