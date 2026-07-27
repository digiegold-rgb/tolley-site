import type { Metadata } from "next";
import Link from "next/link";

import { LotGallery } from "@/components/estate/lot-gallery";
import { WalkthroughBooking } from "@/components/estate/walkthrough-booking";
import { ES_PHONE, ES_PHONE_TEL } from "@/lib/estate";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Our Work | Tolley Estate Sales",
  description:
    "The full catalog from our Independence estate sale — 46 lots, a walkthrough video, and $5,000+ gross in a single weekend. See exactly what we do before you hire us.",
  alternates: { canonical: "https://www.tolley.io/estate/our-work" },
};

// Sale data changes when Jared flips a row; don't serve a stale catalog.
export const revalidate = 300;

export default async function OurWorkPage() {
  const sales = await prisma.estateSale.findMany({
    where: { status: "done" },
    orderBy: { startsAt: "desc" },
  });

  const totalGross = sales.reduce((n, s) => n + (s.grossTotal ?? 0), 0);
  const totalLots = sales.reduce((n, s) => n + (s.photos?.length ?? 0), 0);

  return (
    <main className="relative z-10 min-h-screen px-5 pb-24 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <nav className="pt-6 text-xs" style={{ color: "var(--es-cream-dim)" }}>
          <Link href="/estate" className="hover:underline">
            ← Tolley Estate Sales
          </Link>
        </nav>

        <header className="mt-12 text-center">
          <p className="es-kicker justify-center">The catalog</p>
          <h1 className="es-display mt-5 text-4xl font-semibold sm:text-6xl">
            Our work, <span className="es-italic">unedited.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed sm:text-base" style={{ color: "var(--es-cream-dim)" }}>
            Most companies show you three staged photos. Here is every frame from our last sale —
            the good tables and the cluttered corners both. This is what your home would look like
            the morning we open the doors.
          </p>
        </header>

        {sales.length === 0 ? (
          <div className="es-panel mt-14 p-10 text-center">
            <p style={{ color: "var(--es-cream-dim)" }}>
              Our first catalog goes up right after the next sale closes.
            </p>
          </div>
        ) : null}

        {sales.map((sale, si) => {
          const photos = sale.photos ?? [];
          return (
            <section key={sale.slug} className="mt-16">
              <div className="es-divider mb-10" />

              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[0.68rem] tracking-[0.24em] uppercase" style={{ color: "var(--es-brass)" }}>
                    Sale No. {String(sales.length - si).padStart(3, "0")}
                  </p>
                  <h2 className="es-display mt-2 text-2xl sm:text-3xl">{sale.title}</h2>
                  <p className="mt-1 text-sm" style={{ color: "var(--es-cream-dim)" }}>
                    {sale.areaLabel ?? "Kansas City metro"}
                    {sale.startsAt
                      ? ` · ${sale.startsAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
                      : ""}
                  </p>
                </div>
              </div>

              <dl className="es-result mt-7">
                {sale.grossTotal ? (
                  <div>
                    <dt>Gross</dt>
                    <dd>${sale.grossTotal.toLocaleString()}+</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Days</dt>
                  <dd>2</dd>
                </div>
                <div>
                  <dt>Lots shown</dt>
                  <dd>{photos.length}</dd>
                </div>
                <div>
                  <dt>Left over</dt>
                  <dd className="es-italic">Walls</dd>
                </div>
              </dl>

              {sale.videoUrl ? (
                <figure className="mt-8">
                  <video
                    src={sale.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full border"
                    style={{ borderColor: "var(--es-line)" }}
                  />
                  <figcaption className="mt-3 text-center text-xs" style={{ color: "rgba(243,234,217,0.45)" }}>
                    Walkthrough filmed the morning we opened.
                  </figcaption>
                </figure>
              ) : null}

              <div className="mt-10">
                <LotGallery photos={photos} />
              </div>
            </section>
          );
        })}

        {/* Proof earns the ask — put the booking right where conviction peaks */}
        <section className="mt-20">
          <div className="es-divider mb-10" />
          <WalkthroughBooking />
        </section>

        <footer className="mt-14 text-center">
          <p className="text-sm" style={{ color: "var(--es-cream-dim)" }}>
            {totalLots > 0 ? `${totalLots} lots photographed · ` : ""}
            {totalGross > 0 ? `$${totalGross.toLocaleString()}+ returned to families · ` : ""}
            Independence, serving the whole KC metro
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs" style={{ color: "rgba(243,234,217,0.4)" }}>
            <Link href="/estate/agreement" className="hover:underline">Client Agreement</Link>
            <Link href="/estate/privacy" className="hover:underline">Privacy</Link>
            <Link href="/estate/terms" className="hover:underline">Terms</Link>
            <a href={ES_PHONE_TEL} className="hover:underline">{ES_PHONE}</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
