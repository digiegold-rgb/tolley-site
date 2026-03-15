import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteTracker } from "@/components/analytics/site-tracker";

export const metadata: Metadata = {
  title: "tolley.io | All Services",
  description:
    "Real estate, rentals, home services, hauling, AI tools, and more — all from tolley.io.",
  openGraph: {
    title: "tolley.io — All Services",
    description: "Everything you need. One link.",
    url: "https://www.tolley.io/start",
    type: "website",
  },
};

const SECTIONS = [
  {
    title: "Real Estate",
    services: [
      {
        href: "/homes",
        label: "Real Estate",
        bullets: ["Buy & sell homes", "Kansas City metro", "Licensed agent"],
        color: "from-sky-500 to-sky-600",
        border: "border-sky-500/25",
        glow: "hover:shadow-[0_0_28px_rgba(14,165,233,0.35)]",
        bg: "bg-sky-500/[0.06]",
        image: "/homes/headshot.jpg",
      },
      {
        href: "/markets",
        label: "Market Intelligence",
        bullets: ["Real-time housing data", "Economic indicators", "AI-analyzed"],
        color: "from-teal-500 to-teal-600",
        border: "border-teal-500/25",
        glow: "hover:shadow-[0_0_28px_rgba(20,184,166,0.35)]",
        bg: "bg-teal-500/[0.06]",
        image: "/shop/stock-shop.jpg",
      },
      {
        href: "/pricing",
        label: "T-Agent Pricing",
        bullets: ["AI agent plans", "Real estate tools", "Stripe billing"],
        color: "from-indigo-500 to-indigo-600",
        border: "border-indigo-500/25",
        glow: "hover:shadow-[0_0_28px_rgba(99,102,241,0.35)]",
        bg: "bg-indigo-500/[0.06]",
        image: "/shop/stock-shop.jpg",
      },
    ],
  },
  {
    title: "Rentals",
    services: [
      {
        href: "/wd",
        label: "Washer & Dryer Rental",
        bullets: ["Monthly rental", "Delivered & installed", "No credit check"],
        color: "from-blue-500 to-blue-600",
        border: "border-blue-500/25",
        glow: "hover:shadow-[0_0_28px_rgba(59,130,246,0.35)]",
        bg: "bg-blue-500/[0.06]",
        image: "/wd/stock-wd.jpg",
      },
      {
        href: "/trailer",
        label: "Trailer Rental",
        bullets: ["Utility & car haulers", "16ft to 20ft", "Up to 10,000 lbs"],
        color: "from-amber-500 to-amber-600",
        border: "border-amber-500/25",
        glow: "hover:shadow-[0_0_28px_rgba(245,158,11,0.35)]",
        bg: "bg-amber-500/[0.06]",
        image: "/trailer/20/20-1.jpg",
      },
      {
        href: "/generator",
        label: "Generator Rental",
        bullets: ["Portable power", "Jobs & events", "Delivery available"],
        color: "from-yellow-500 to-yellow-600",
        border: "border-yellow-500/25",
        glow: "hover:shadow-[0_0_28px_rgba(234,179,8,0.35)]",
        bg: "bg-yellow-500/[0.06]",
        image: "/generator/gen-1.jpg",
      },
    ],
  },
  {
    title: "Home Services",
    services: [
      {
        href: "/hvac",
        label: "HVAC Service",
        bullets: ["Heating & cooling", "24/7 emergency", "The Cool Guys KC"],
        color: "from-cyan-500 to-cyan-600",
        border: "border-cyan-500/25",
        glow: "hover:shadow-[0_0_28px_rgba(6,182,212,0.35)]",
        bg: "bg-cyan-500/[0.06]",
        image: "/hvac/mascot.jpg",
      },
      {
        href: "/pools",
        label: "Pool Supplies",
        bullets: ["Contractor pricing", "Delivered to your door", "Beat retail prices"],
        color: "from-cyan-500 to-cyan-600",
        border: "border-cyan-500/25",
        glow: "hover:shadow-[0_0_28px_rgba(6,182,212,0.35)]",
        bg: "bg-cyan-500/[0.06]",
        image: "/pools/stock-pools.jpg",
      },
      {
        href: "/moving",
        label: "Moving Supplies",
        bullets: ["Reusable bins", "Packing kits", "Skip the cardboard"],
        color: "from-emerald-500 to-emerald-600",
        border: "border-emerald-500/25",
        glow: "hover:shadow-[0_0_28px_rgba(16,185,129,0.35)]",
        bg: "bg-emerald-500/[0.06]",
        image: "/moving/mv-1.jpg",
      },
      {
        href: "/moupins",
        label: "Precision Transfer",
        bullets: ["Junk removal", "Moving services", "Same-day quotes"],
        color: "from-green-500 to-green-600",
        border: "border-green-500/25",
        glow: "hover:shadow-[0_0_28px_rgba(34,197,94,0.35)]",
        bg: "bg-green-500/[0.06]",
        image: "/shop/stock-shop.jpg",
      },
    ],
  },
  {
    title: "Hauling & Delivery",
    services: [
      {
        href: "/junkinjays",
        label: "Junkin' Jay's",
        bullets: ["Scrap metal pickup", "Batteries & copper", "Junk hauling"],
        color: "from-orange-500 to-orange-600",
        border: "border-orange-500/25",
        glow: "hover:shadow-[0_0_28px_rgba(232,93,4,0.35)]",
        bg: "bg-orange-500/[0.06]",
        image: "/shop/stock-shop.jpg",
      },
      {
        href: "/lastmile",
        label: "Last-Mile Delivery",
        bullets: ["Contractors & B2B", "3,000+ deliveries", "Starting at $2/mile"],
        color: "from-red-500 to-red-600",
        border: "border-red-500/25",
        glow: "hover:shadow-[0_0_28px_rgba(239,68,68,0.35)]",
        bg: "bg-red-500/[0.06]",
        image: "/lastmile/jared-pallet.jpg",
      },
    ],
  },
  {
    title: "AI & Ventures",
    services: [
      {
        href: "/video",
        label: "AI Video",
        bullets: ["Text-to-video", "NVIDIA Blackwell", "Cinematic quality"],
        color: "from-purple-500 to-violet-600",
        border: "border-purple-500/25",
        glow: "hover:shadow-[0_0_28px_rgba(168,85,247,0.35)]",
        bg: "bg-purple-500/[0.06]",
        image: "/shop/stock-shop.jpg",
      },
      {
        href: "/vater",
        label: "Vater Ventures",
        bullets: ["Dropship", "YouTube", "Merch", "GovBids", "Courses"],
        color: "from-sky-500 to-amber-500",
        border: "border-sky-500/25",
        glow: "hover:shadow-[0_0_28px_rgba(14,165,233,0.35)]",
        bg: "bg-sky-500/[0.06]",
        image: "/shop/stock-shop.jpg",
      },
    ],
  },
  {
    title: "Shop",
    services: [
      {
        href: "/shop",
        label: "Shop",
        bullets: ["Furniture & home goods", "New items daily", "Message to buy"],
        color: "from-pink-500 to-pink-600",
        border: "border-pink-500/25",
        glow: "hover:shadow-[0_0_28px_rgba(236,72,153,0.35)]",
        bg: "bg-pink-500/[0.06]",
        image: "/shop/stock-shop.jpg",
      },
    ],
  },
] as const;

export default function StartPage() {
  return (
    <div className="start-page">
      <SiteTracker site="start" />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center px-5 py-10 sm:py-14">
        {/* Sections */}
        <div className="flex w-full flex-col gap-10">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              {/* Section header */}
              <div className="mb-4 flex items-center gap-3">
                <span className="flex-shrink-0 text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">
                  {section.title}
                </span>
                <div className="h-px flex-1 bg-neutral-800" />
              </div>

              {/* Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.services.map((svc) => (
                  <Link
                    key={svc.href}
                    href={svc.href}
                    className={`group flex flex-col items-center rounded-2xl border ${svc.border} ${svc.bg} px-5 py-5 text-center transition-all duration-200 hover:-translate-y-1 ${svc.glow}`}
                  >
                    <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border border-white/15 shadow-lg">
                      <Image
                        src={svc.image}
                        alt={svc.label}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                    <p className="mt-3 text-lg font-bold tracking-wide text-white">
                      {svc.label}
                    </p>
                    <ul className="mt-1.5 flex flex-wrap justify-center gap-x-2 gap-y-1">
                      {svc.bullets.map((b) => (
                        <li
                          key={b}
                          className="text-xs text-neutral-400"
                        >
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="mt-10 text-xs text-neutral-600">
          &copy; {new Date().getFullYear()} tolley.io &middot; Independence, MO
        </p>
      </main>
    </div>
  );
}
