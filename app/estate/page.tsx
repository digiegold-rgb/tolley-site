import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MoreFromTolley } from "@/components/shared/more-from-tolley";
import { EmailCaptureForm } from "@/components/tools/EmailCaptureForm";
import { EstateQuoteForm } from "@/components/estate/quote-form";
import SaleCard, { type SaleCardData } from "@/components/estate/sale-card";
import SaleCarousel from "@/components/estate/sale-carousel";
import KeepShopping from "@/components/estate/keep-shopping";
import {
  ES_PHONE,
  ES_PHONE_TEL,
  ES_PHONE_SMS,
  ES_AREA,
  ES_STEPS,
  ES_DIFFS,
  ES_ADVERTISED_ON,
  ES_FAQ,
} from "@/lib/estate";

export const revalidate = 300;

const BASE = "https://www.tolley.io";

interface SaleDay {
  date: string;
  open: string;
  close: string;
  note?: string;
}

async function fetchSales() {
  const [upcoming, past] = await Promise.all([
    prisma.estateSale.findMany({
      where: { status: { in: ["upcoming", "live"] } },
      orderBy: { startsAt: "asc" },
      take: 3,
    }),
    prisma.estateSale.findMany({
      where: { status: "done" },
      orderBy: { startsAt: "desc" },
      take: 3,
    }),
  ]);
  return { upcoming, past };
}

type SaleRow = Awaited<ReturnType<typeof fetchSales>>["upcoming"][number];

function toCardData(sale: SaleRow): SaleCardData {
  // Done sales never expose an address — family privacy outlives the reveal window.
  const published =
    sale.status !== "done" &&
    sale.addressPublishAt !== null &&
    sale.addressPublishAt.getTime() <= Date.now();
  return {
    slug: sale.slug,
    title: sale.title,
    areaLabel: sale.areaLabel,
    address: published ? sale.address : null,
    days: (sale.days as unknown as SaleDay[]) ?? [],
    startsAtIso: sale.startsAt.toISOString(),
    addressPublishAtIso: sale.addressPublishAt?.toISOString() ?? null,
    highlights: sale.highlights,
    status: sale.status,
  };
}

function buildJsonLd(upcoming: SaleRow[]) {
  const business = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${BASE}/estate#business`,
    name: "Tolley Estate Sales",
    url: `${BASE}/estate`,
    telephone: "+1-913-283-3826",
    description:
      "Boutique, family-run estate sale company in Independence, MO: free walkthrough, staging, research-backed pricing, real marketing, every form of payment, fast itemized settlement. Zero upfront cost.",
    areaServed: [
      { "@type": "City", name: "Independence", containedInPlace: { "@type": "State", name: "Missouri" } },
      "Kansas City metro",
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Independence",
      addressRegion: "MO",
      addressCountry: "US",
    },
    parentOrganization: {
      "@type": "Organization",
      name: "Your KC Homes LLC",
      url: BASE,
    },
    priceRange: "Free walkthrough — commission-based",
  };

  const events = upcoming.map((sale) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: sale.title,
    startDate: sale.startsAt.toISOString(),
    endDate: sale.endsAt.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    isAccessibleForFree: true,
    location: {
      "@type": "Place",
      name: sale.areaLabel,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Independence",
        addressRegion: "MO",
        addressCountry: "US",
      },
    },
    organizer: { "@id": `${BASE}/estate#business` },
    url: `${BASE}/estate/sales/${sale.slug}`,
    ...(sale.description ? { description: sale.description } : {}),
  }));

  return [business, ...events];
}

export default async function EstatePage() {
  const { upcoming, past } = await fetchSales();
  const jsonLd = buildJsonLd(upcoming);
  // Feature the soonest upcoming sale that already has photos in the hero carousel.
  const featured = upcoming.find((s) => s.photos.length > 0);

  return (
    <main className="relative z-10 min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      {/* Sticky contact strip */}
      <div
        className="sticky top-0 z-50 flex items-center justify-center gap-3 border-b px-4 py-2.5 text-center backdrop-blur"
        style={{ background: "rgba(23,18,16,0.92)", borderColor: "var(--es-line)" }}
      >
        <span className="text-sm font-semibold">Free walkthroughs</span>
        <span style={{ color: "var(--es-line)" }}>|</span>
        <a
          href={ES_PHONE_TEL}
          className="text-sm font-bold underline decoration-2 underline-offset-2"
          style={{ color: "var(--es-brass-bright)" }}
        >
          {ES_PHONE}
        </a>
        <span style={{ color: "var(--es-line)" }}>|</span>
        <a href={ES_PHONE_SMS} className="text-xs" style={{ color: "var(--es-cream-dim)" }}>
          Call or Text
        </a>
      </div>

      {/* Hero */}
      <section className="relative px-5 pt-16 pb-14 text-center sm:pt-24">
        <div className="mx-auto max-w-3xl">
          <p className="es-kicker justify-center">Tolley Estate Sales · {ES_AREA}</p>
          <h1 className="es-display mt-5 text-4xl font-semibold leading-tight sm:text-6xl">
            A whole house of memories,{" "}
            <span className="es-italic" style={{ color: "var(--es-brass-bright)" }}>
              sold with respect.
            </span>
          </h1>
          <p
            className="mx-auto mt-6 max-w-xl text-lg sm:text-xl"
            style={{ color: "var(--es-cream-dim)" }}
          >
            We stage it, price it against real sold comps, market it to thousands
            of KC buyers, and run the sale — you get an itemized settlement,
            fast. You pay nothing up front.
          </p>
          <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a href="#walkthrough" className="es-btn-primary px-8 py-4 text-lg">
              Book a free walkthrough
            </a>
            <a href={ES_PHONE_TEL} className="es-btn-secondary px-8 py-4 text-lg">
              Call {ES_PHONE}
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-20 px-5 pb-20 sm:px-8">
        {/* Proof band — real results from completed sales */}
        {past.length > 0 && (
          <section
            className="es-enter -mt-4 scroll-mt-24"
            style={{ "--enter-delay": "0.02s" } as React.CSSProperties}
          >
            <div className="es-panel p-7 text-center sm:p-9">
              <p className="es-kicker justify-center">Real results</p>
              <div className="mt-5 grid gap-6 sm:grid-cols-3">
                <div>
                  <p className="es-display text-3xl font-semibold sm:text-4xl" style={{ color: "var(--es-brass-bright)" }}>
                    ${Math.round(past.reduce((sum, s) => sum + (s.grossTotal ?? 0), 0)).toLocaleString("en-US")}+
                  </p>
                  <p className="mt-1 text-sm" style={{ color: "var(--es-cream-dim)" }}>
                    gross in {past.length === 1 ? "one weekend" : `${past.length} sales`}
                  </p>
                </div>
                <div>
                  <p className="es-display text-3xl font-semibold sm:text-4xl" style={{ color: "var(--es-brass-bright)" }}>
                    2 days
                  </p>
                  <p className="mt-1 text-sm" style={{ color: "var(--es-cream-dim)" }}>
                    sold down to the walls
                  </p>
                </div>
                <div>
                  <p className="es-display text-3xl font-semibold sm:text-4xl" style={{ color: "var(--es-brass-bright)" }}>
                    $0
                  </p>
                  <p className="mt-1 text-sm" style={{ color: "var(--es-cream-dim)" }}>
                    up front from the family — ever
                  </p>
                </div>
              </div>
              <p className="mt-5 text-sm" style={{ color: "var(--es-cream-dim)" }}>
                <Link
                  href={`/estate/sales/${past[0].slug}`}
                  className="underline underline-offset-2"
                  style={{ color: "var(--es-brass)" }}
                >
                  See our latest sale — photos, video, the whole thing →
                </Link>
              </p>
            </div>
          </section>
        )}

        {/* Featured sale carousel — photos + walkthrough video, front and center */}
        {featured && (
          <section
            className="es-enter -mt-6 scroll-mt-24"
            style={{ "--enter-delay": "0.02s" } as React.CSSProperties}
          >
            <SaleCarousel
              sale={{
                slug: featured.slug,
                title: featured.title,
                areaLabel: featured.areaLabel,
                photos: featured.photos,
                videoUrl: featured.videoUrl,
                photosUpdatedAt: featured.photosUpdatedAt?.toISOString() ?? null,
              }}
            />
          </section>
        )}

        {/* Upcoming sale(s) — or the between-sales capture panel */}
        {upcoming.length > 0 ? (
          <section
            id="sales"
            className="es-enter scroll-mt-24"
            style={{ "--enter-delay": "0.05s" } as React.CSSProperties}
          >
            <div className="space-y-6">
              {upcoming.map((sale) => (
                <SaleCard key={sale.id} sale={toCardData(sale)} />
              ))}
            </div>
          </section>
        ) : (
          <section
            id="sales"
            className="es-enter scroll-mt-24"
            style={{ "--enter-delay": "0.05s" } as React.CSSProperties}
          >
            <div className="es-panel p-7 text-center sm:p-9">
              <p className="es-kicker justify-center">Next sale</p>
              <h2 className="es-display mt-3 text-2xl sm:text-3xl">
                The next sale is being scheduled now
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm" style={{ color: "var(--es-cream-dim)" }}>
                We run one or two sales a month, right here in Independence. Join
                the early list below and the next address lands in your inbox the
                night before the public gets it.
              </p>
              <a href="#alerts" className="es-btn-primary mt-6 inline-block px-7 py-3">
                Get on the early list
              </a>
            </div>
          </section>
        )}

        {/* Capture the estate-sale traffic — can't-make-it shoppers → the rest of Tolley */}
        <section
          className="es-enter scroll-mt-24"
          style={{ "--enter-delay": "0.08s" } as React.CSSProperties}
        >
          <KeepShopping />
        </section>

        {/* VIP list */}
        <section
          id="alerts"
          className="es-enter scroll-mt-24"
          style={{ "--enter-delay": "0.1s" } as React.CSSProperties}
        >
          <div className="es-panel mx-auto max-w-2xl p-7 text-center sm:p-9">
            <p className="es-kicker justify-center">The early list</p>
            <h2 className="es-display mt-3 text-2xl sm:text-3xl">
              Get every address the night before
            </h2>
            <p className="mt-3 text-sm" style={{ color: "var(--es-cream-dim)" }}>
              One email per sale: the address, the best finds, and door-opening
              time — delivered before the public release. Serious shoppers plan
              their route the night before. Be one of them.
            </p>
            <EmailCaptureForm
              source="estate-alerts"
              ctaText="Put me on the list"
              successMessage="You're in — you'll get the next address before anyone else."
              className="mx-auto mt-5 max-w-md"
            />
          </div>
        </section>

        {/* How it works */}
        <section className="es-enter" style={{ "--enter-delay": "0.15s" } as React.CSSProperties}>
          <div className="text-center">
            <p className="es-kicker justify-center">For families &amp; executors</p>
            <h2 className="es-display mt-3 text-3xl sm:text-4xl">
              Three steps. Zero upfront cost.
            </h2>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {ES_STEPS.map((step) => (
              <div key={step.num} className="es-card p-7">
                <div
                  className="es-display flex h-11 w-11 items-center justify-center rounded text-xl font-semibold"
                  style={{ background: "var(--es-brass)", color: "#1c150f" }}
                >
                  {step.num}
                </div>
                <h3 className="es-display mt-5 text-xl">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--es-cream-dim)" }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Differentiators */}
        <section className="es-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <div className="text-center">
            <p className="es-kicker justify-center">Why Tolley</p>
            <h2 className="es-display mt-3 text-3xl sm:text-4xl">
              Not our first day selling
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base" style={{ color: "var(--es-cream-dim)" }}>
              Our first sale grossed over $5,000 in two days and sold the home
              down to the walls. Behind it is a resale operation that reaches
              thousands of Kansas City buyers every single week — your sale
              plugs straight into that machine.
            </p>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            {ES_DIFFS.map((d) => (
              <div key={d.title} className="es-card p-7">
                <h3 className="es-display text-lg" style={{ color: "var(--es-brass-bright)" }}>
                  {d.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--es-cream-dim)" }}>
                  {d.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Selling the house too? — the real-estate capture */}
        <section className="es-enter" style={{ "--enter-delay": "0.22s" } as React.CSSProperties}>
          <div className="es-panel p-8 text-center sm:p-10">
            <p className="es-kicker justify-center">One call does it all</p>
            <h2 className="es-display mt-3 text-2xl sm:text-3xl">
              Selling the house too?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base" style={{ color: "var(--es-cream-dim)" }}>
              Jared is a licensed Kansas City real estate agent. We can run the
              estate sale, leave the home broom-clean, and list it — one team,
              one timeline, no juggling three companies while you&apos;re already
              dealing with enough.
            </p>
            <Link
              href="/homes?ref=estate"
              className="es-btn-secondary mt-6 inline-block px-7 py-3"
            >
              Talk about the house
            </Link>
          </div>
        </section>

        {/* Where we advertise */}
        <section className="es-enter" style={{ "--enter-delay": "0.25s" } as React.CSSProperties}>
          <div className="es-panel p-8 sm:p-10">
            <div className="text-center">
              <p className="es-kicker justify-center">Where your sale gets seen</p>
              <h2 className="es-display mt-3 text-2xl sm:text-3xl">
                Every place estate shoppers actually look
              </h2>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ES_ADVERTISED_ON.map((p) => (
                <div key={p.name} className="rounded border px-4 py-3" style={{ borderColor: "var(--es-line)" }}>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs" style={{ color: "var(--es-cream-dim)" }}>
                    {p.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Past sales — social proof once sales complete */}
        {past.length > 0 && (
          <section className="es-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
            <div className="text-center">
              <p className="es-kicker justify-center">Recent sales</p>
              <h2 className="es-display mt-3 text-3xl">Homes we&apos;ve sold down to the walls</h2>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {past.map((sale) => (
                <Link key={sale.id} href={`/estate/sales/${sale.slug}`} className="es-card block p-6">
                  <h3 className="es-display text-lg">{sale.title}</h3>
                  <p className="mt-1 text-xs" style={{ color: "var(--es-cream-dim)" }}>
                    {sale.areaLabel} ·{" "}
                    {sale.startsAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                  {sale.grossTotal != null && sale.grossTotal > 0 && (
                    <p className="mt-2 text-sm font-semibold" style={{ color: "var(--es-brass-bright)" }}>
                      ${Math.round(sale.grossTotal).toLocaleString("en-US")}+ weekend · sold to the walls
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className="es-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <div className="text-center">
            <p className="es-kicker justify-center">Straight answers</p>
            <h2 className="es-display mt-3 text-3xl sm:text-4xl">Questions families ask</h2>
          </div>
          <div className="mx-auto mt-8 max-w-2xl space-y-3">
            {ES_FAQ.map((faq) => (
              <details key={faq.q} className="es-panel group overflow-hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-semibold">
                  {faq.q}
                  <span
                    className="text-xl transition-transform group-open:rotate-45"
                    style={{ color: "var(--es-brass)" }}
                  >
                    +
                  </span>
                </summary>
                <div className="px-5 pb-4 text-sm leading-relaxed" style={{ color: "var(--es-cream-dim)" }}>
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
          <p className="mt-6 text-center text-xs" style={{ color: "var(--es-cream-dim)" }}>
            Want the fine print? Read our{" "}
            <Link href="/estate/agreement" className="underline underline-offset-2" style={{ color: "var(--es-brass)" }}>
              client agreement
            </Link>{" "}
            — we publish it, because you shouldn&apos;t have to sign something you
            couldn&apos;t read first.
          </p>
        </section>

        {/* Walkthrough form */}
        <section
          id="walkthrough"
          className="es-enter scroll-mt-24"
          style={{ "--enter-delay": "0.35s" } as React.CSSProperties}
        >
          <div className="mx-auto max-w-2xl">
            <div className="text-center">
              <p className="es-kicker justify-center">Free walkthrough</p>
              <h2 className="es-display mt-3 mb-3 text-3xl sm:text-4xl">
                Tell us about the home
              </h2>
              <p className="mb-8 text-sm" style={{ color: "var(--es-cream-dim)" }}>
                Jared calls or texts back, usually the same day. No pressure, no
                obligation — just a plan and a number.
              </p>
            </div>
            <EstateQuoteForm />
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t px-5 py-10 text-center" style={{ borderColor: "var(--es-line)" }}>
        <div className="es-divider mx-auto mb-6 max-w-xs text-sm">◆</div>
        <p className="text-sm" style={{ color: "var(--es-cream-dim)" }}>
          &copy; {new Date().getFullYear()} Tolley Estate Sales · {ES_AREA} ·{" "}
          <a href={ES_PHONE_TEL} style={{ color: "var(--es-brass)" }}>
            {ES_PHONE}
          </a>
        </p>
        <p className="mt-1 text-xs" style={{ color: "rgba(243,234,217,0.35)" }}>
          Operated by Your KC Homes LLC · Part of{" "}
          <a href="https://www.tolley.io/circle" className="underline underline-offset-2">
            the Tolley circle
          </a>
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs" style={{ color: "rgba(243,234,217,0.4)" }}>
          <Link href="/estate/agreement" className="hover:underline">Client Agreement</Link>
          <Link href="/cleanouts" className="hover:underline">Cleanouts</Link>
          <Link href="/shop" className="hover:underline">Shop</Link>
          <Link href="/homes" className="hover:underline">Real Estate</Link>
          <Link href="/circle" className="hover:underline">Everything We Do</Link>
        </div>
      </footer>
      <MoreFromTolley currentSubsite="estate" />
    </main>
  );
}
