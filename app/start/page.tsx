import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteTracker } from "@/components/analytics/site-tracker";

export const metadata: Metadata = {
  title: "tolley.io | All Services",
  description:
    "Real estate, trailer rental, generator rental, last-mile delivery, washer & dryer rental, HVAC, moving supplies — all from tolley.io.",
  openGraph: {
    title: "tolley.io — All Services",
    description: "Everything you need. One link.",
    url: "https://www.tolley.io/start",
    type: "website",
  },
};

const SERVICES = [
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
    href: "/lastmile",
    label: "Last-Mile Delivery",
    bullets: ["Contractors & B2B", "3,000+ deliveries", "Starting at $2/mile"],
    color: "from-red-500 to-red-600",
    border: "border-red-500/25",
    glow: "hover:shadow-[0_0_28px_rgba(239,68,68,0.35)]",
    bg: "bg-red-500/[0.06]",
    image: "/lastmile/jared-pallet.jpg",
  },
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
    href: "/generator",
    label: "Generator Rental",
    bullets: ["Portable power", "Jobs & events", "Delivery available"],
    color: "from-yellow-500 to-yellow-600",
    border: "border-yellow-500/25",
    glow: "hover:shadow-[0_0_28px_rgba(234,179,8,0.35)]",
    bg: "bg-yellow-500/[0.06]",
    image: "/generator/gen-1.jpg",
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
    href: "/shop",
    label: "Shop",
    bullets: ["Furniture & home goods", "New items daily", "Message to buy"],
    color: "from-pink-500 to-pink-600",
    border: "border-pink-500/25",
    glow: "hover:shadow-[0_0_28px_rgba(236,72,153,0.35)]",
    bg: "bg-pink-500/[0.06]",
    image: "/shop/stock-shop.jpg",
  },
] as const;

export default function StartPage() {
  return (
    <div className="start-page">
      <SiteTracker site="start" />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-xl flex-col items-center px-5 py-10 sm:py-14">
        {/* Service buttons */}
        <div className="flex w-full flex-col gap-4">
          {SERVICES.map((svc) => (
            <Link
              key={svc.href}
              href={svc.href}
              className={`group flex items-center gap-5 rounded-2xl border ${svc.border} ${svc.bg} px-6 py-5 transition-all duration-200 hover:-translate-y-1 ${svc.glow}`}
            >
              <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-white/15 shadow-lg">
                <Image
                  src={svc.image}
                  alt={svc.label}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold tracking-wide text-white">
                  {svc.label}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {svc.bullets.map((b) => (
                    <li
                      key={b}
                      className="text-sm text-neutral-400"
                    >
                      <span className="mr-1.5 text-neutral-600">&bull;</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <svg
                className="h-5 w-5 flex-shrink-0 text-neutral-600 transition group-hover:translate-x-1 group-hover:text-white"
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

        {/* Footer */}
        <p className="mt-10 text-xs text-neutral-600">
          &copy; {new Date().getFullYear()} tolley.io &middot; Independence, MO
        </p>
      </main>
    </div>
  );
}
