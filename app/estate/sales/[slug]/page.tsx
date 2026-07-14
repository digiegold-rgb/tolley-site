import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EmailCaptureForm } from "@/components/tools/EmailCaptureForm";
import SaleCard, { type SaleCardData } from "@/components/estate/sale-card";
import { ES_PHONE, ES_PHONE_TEL } from "@/lib/estate";
import KeepShopping from "@/components/estate/keep-shopping";

export const revalidate = 300;

const BASE = "https://www.tolley.io";

interface SaleDay {
  date: string;
  open: string;
  close: string;
  note?: string;
}

async function fetchSale(slug: string) {
  return prisma.estateSale.findUnique({ where: { slug } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sale = await fetchSale(slug);
  if (!sale) return { title: "Sale not found | Tolley Estate Sales" };
  const description =
    sale.description ??
    `Estate sale in ${sale.areaLabel}. Address released the day before — join the list at tolley.io/estate for early access.`;
  return {
    title: `${sale.title} | Tolley Estate Sales`,
    description,
    openGraph: {
      title: sale.title,
      description,
      url: `${BASE}/estate/sales/${sale.slug}`,
      type: "website",
      images: sale.photos.slice(0, 1).map((url) => ({ url })),
    },
    alternates: { canonical: `${BASE}/estate/sales/${sale.slug}` },
  };
}

export default async function EstateSalePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sale = await fetchSale(slug);
  if (!sale) notFound();

  const published =
    sale.addressPublishAt !== null && sale.addressPublishAt.getTime() <= Date.now();
  const cardData: SaleCardData = {
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

  const jsonLd = {
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
      name: published && sale.address ? sale.address : sale.areaLabel,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Independence",
        addressRegion: "MO",
        addressCountry: "US",
        ...(published && sale.address ? { streetAddress: sale.address } : {}),
      },
    },
    organizer: {
      "@type": "LocalBusiness",
      name: "Tolley Estate Sales",
      url: `${BASE}/estate`,
      telephone: "+1-913-283-3826",
    },
    ...(sale.description ? { description: sale.description } : {}),
    ...(sale.photos.length > 0 ? { image: sale.photos } : {}),
    url: `${BASE}/estate/sales/${sale.slug}`,
  };

  return (
    <main className="relative z-10 min-h-screen px-5 pb-20 sm:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <div className="mx-auto max-w-4xl">
        <nav className="pt-6 text-xs" style={{ color: "var(--es-cream-dim)" }}>
          <Link href="/estate" className="hover:underline">
            ← Tolley Estate Sales
          </Link>
        </nav>

        <div className="mt-6">
          <SaleCard sale={cardData} />
        </div>

        {sale.status === "done" && (
          <p
            className="es-panel mt-6 p-4 text-center text-sm"
            style={{ color: "var(--es-cream-dim)" }}
          >
            This sale has ended. Join the list below and you&apos;ll never miss
            the next one.
          </p>
        )}

        {sale.description && (
          <div className="es-panel mt-6 p-7">
            <p className="es-kicker">About this sale</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--es-cream-dim)" }}>
              {sale.description}
            </p>
          </div>
        )}

        {/* Walkthrough video — an easy way to feel the sale before you come */}
        {sale.videoUrl && (
          <div className="mt-8">
            <p className="es-kicker">Take a walk through</p>
            <p className="mt-2 text-sm" style={{ color: "var(--es-cream-dim)" }}>
              A quick look inside — press play and see what&apos;s waiting.
            </p>
            <div
              className="mt-4 overflow-hidden rounded"
              style={{ background: "var(--es-panel)" }}
            >
              <video
                controls
                playsInline
                preload="metadata"
                className="mx-auto max-h-[80vh] w-auto"
              >
                <source src={sale.videoUrl} type="video/mp4" />
              </video>
            </div>
          </div>
        )}

        {/* Photo gallery — populated as photos land */}
        {sale.photos.length > 0 ? (
          <div className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="es-kicker">The finds</p>
              {sale.photosUpdatedAt && (
                <p className="text-xs" style={{ color: "var(--es-brass-bright)" }}>
                  🕒 Updated{" "}
                  {sale.photosUpdatedAt.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "America/Chicago",
                  })}{" "}
                  CT
                </p>
              )}
            </div>
            <p className="mt-2 text-sm" style={{ color: "var(--es-brass-bright)" }}>
              📸 New photos added every day — Facebook only shows a few, so the full
              gallery lives here. Check back daily; fresh finds keep landing right up to
              sale day.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {sale.photos.map((url, i) => (
                <div key={url} className="relative aspect-square overflow-hidden rounded" style={{ background: "var(--es-panel)" }}>
                  <Image
                    src={url}
                    alt={`${sale.title} — photo ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, 33vw"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : sale.status !== "done" ? (
          <div className="es-panel mt-8 p-7 text-center">
            <p className="es-display text-lg" style={{ color: "var(--es-brass-bright)" }}>
              📷 Photos landing soon
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--es-cream-dim)" }}>
              We photograph everything before sale day. Join the list and
              you&apos;ll get the best finds in your inbox the moment they&apos;re up.
            </p>
          </div>
        ) : null}

        {/* Can't-make-it capture → the rest of Tolley */}
        <div className="mt-8">
          <KeepShopping />
        </div>

        {/* Capture */}
        <div className="es-panel mt-8 p-7 text-center" id="alerts">
          <p className="es-kicker justify-center">Never miss a sale</p>
          <h2 className="es-display mt-3 text-2xl">
            Addresses in your inbox — the night before
          </h2>
          <EmailCaptureForm
            source="estate-alerts"
            ctaText="Put me on the list"
            successMessage="You're in — you'll get the next address before anyone else."
            className="mx-auto mt-4 max-w-md"
          />
        </div>

        <p className="mt-8 text-center text-sm" style={{ color: "var(--es-cream-dim)" }}>
          Questions about this sale? Call or text{" "}
          <a href={ES_PHONE_TEL} className="font-semibold" style={{ color: "var(--es-brass)" }}>
            {ES_PHONE}
          </a>
          {" "}· Selling a home&apos;s contents?{" "}
          <Link href="/estate#walkthrough" className="underline underline-offset-2" style={{ color: "var(--es-brass)" }}>
            Book a free walkthrough
          </Link>
        </p>
      </div>
    </main>
  );
}
