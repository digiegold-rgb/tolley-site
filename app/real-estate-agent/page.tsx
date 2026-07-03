import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Real estate agent — Kansas City metro | Your KC Homes",
  description:
    "Jared Tolley with Your KC Homes serves the entire KC metro — Independence, Lee's Summit, Blue Springs, Overland Park, Olathe, and beyond. Pick your area to see local market FAQs.",
  alternates: { canonical: "https://www.tolley.io/real-estate-agent" },
};

export default async function NeighborhoodIndex() {
  const pages = await prisma.neighborhoodPage.findMany({
    where: { published: true },
    orderBy: [{ state: "asc" }, { city: "asc" }],
    select: { slug: true, name: true, city: true, state: true },
  });

  const moPages = pages.filter((p) => p.state === "MO");
  const ksPages = pages.filter((p) => p.state === "KS");

  return (
    <main className="min-h-screen bg-[#06050a] text-white">
      <div
        aria-hidden="true"
        className="site-dot-grid-purple pointer-events-none fixed inset-0 z-0"
      />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        <nav className="text-xs text-white/40">
          <Link href="/" className="hover:text-white/70">
            tolley.io
          </Link>{" "}
          / <span className="text-white/70">real estate agent</span>
        </nav>

        <header className="mt-6">
          <h1 className="text-3xl font-bold tracking-tight">
            Real estate agent —{" "}
            <span className="bg-gradient-to-r from-purple-300 to-violet-400 bg-clip-text text-transparent">
              KC metro
            </span>
          </h1>
          <p className="mt-2 text-white/60">
            Pick your area for local market FAQs, school info, and a direct
            line to Jared with Your KC Homes.
          </p>
        </header>

        {pages.length === 0 && (
          <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
            Pages are still being generated. Check back shortly.
          </div>
        )}

        {moPages.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">Missouri</h2>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {moPages.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/real-estate-agent/${p.slug}`}
                    className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85 hover:bg-white/10"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {ksPages.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Kansas</h2>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ksPages.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/real-estate-agent/${p.slug}`}
                    className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85 hover:bg-white/10"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
