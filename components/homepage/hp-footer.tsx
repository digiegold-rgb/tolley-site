import Link from "next/link";

const columns = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Demo", href: "mailto:support@tolley.io?subject=T-Agent%20Demo%20Request" },
    ],
  },
  {
    heading: "Services",
    links: [
      { label: "Washer & Dryer Rental", href: "/wd" },
      { label: "Pool Supplies", href: "/pools" },
      { label: "Last-Mile Delivery", href: "/lastmile" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Security", href: "/security" },
      { label: "Data Retention", href: "/data-retention" },
    ],
  },
];

// Every public subsite, grouped — the homepage is the one page that links to
// all of them, so several of these routes have no other inbound link.
const directory = [
  {
    heading: "Rentals",
    links: [
      { label: "All Rentals", href: "/rental" },
      { label: "Washer & Dryer", href: "/wd" },
      { label: "Trailers", href: "/trailer" },
      { label: "Generators", href: "/generator" },
      { label: "Tables & Chairs", href: "/tables" },
      { label: "Picnic Tables", href: "/picnic-table" },
      { label: "Giant Kerplunk", href: "/kerplunk" },
    ],
  },
  {
    heading: "Home Services",
    links: [
      { label: "Cleanouts", href: "/cleanouts" },
      { label: "Moving & Hauling", href: "/moving" },
      { label: "Scrap Pickup", href: "/junkinjays" },
      { label: "HVAC", href: "/hvac" },
      { label: "Pool Supplies", href: "/pools" },
      { label: "Last-Mile Delivery", href: "/lastmile" },
    ],
  },
  {
    heading: "Real Estate & More",
    links: [
      { label: "KC Homes", href: "/homes" },
      { label: "Work With an Agent", href: "/real-estate-agent" },
      { label: "Estate Sales", href: "/estate" },
      { label: "Shop", href: "/shop" },
      { label: "Free Tools", href: "/tools" },
      { label: "Blog", href: "/blog" },
      { label: "The Circle", href: "/circle" },
      { label: "About", href: "/about" },
    ],
  },
];

export function HpFooter() {
  return (
    <footer className="relative z-10 border-t border-white/10 px-5 pt-12 pb-8 sm:px-8">
      {/* Gradient separator glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent"
      />

      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-4">
        {/* Brand */}
        <div>
          <p className="text-[0.72rem] font-medium tracking-[0.42em] text-white/90 uppercase">
            t-agent
          </p>
          <p className="mt-3 text-xs leading-5 text-white/55">
            AI-powered lead intelligence for real estate professionals.
          </p>

          {/* Social icons */}
          <div className="mt-4 flex gap-3">
            <a
              href="mailto:support@tolley.io"
              aria-label="Email"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition hover:border-white/20 hover:text-white/80"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </a>
          </div>

          <p className="mt-4 text-xs text-white/40">
            &copy; {new Date().getFullYear()} Tolley.io. All rights reserved.
          </p>
        </div>

        {/* Link columns */}
        {columns.map((col) => (
          <div key={col.heading}>
            <p className="text-[0.68rem] font-semibold tracking-[0.14em] text-white/60 uppercase">
              {col.heading}
            </p>
            <ul className="mt-3 space-y-2">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-xs text-white/55 transition hover:text-white/90"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* More from Tolley — compact directory so every subsite has an inbound link */}
      <div className="mx-auto mt-10 max-w-6xl border-t border-white/[0.07] pt-8">
        <p className="text-[0.68rem] font-semibold tracking-[0.14em] text-white/45 uppercase">
          More from Tolley
        </p>
        <div className="mt-4 grid gap-6 sm:grid-cols-3">
          {directory.map((col) => (
            <div key={col.heading}>
              <p className="text-[0.62rem] tracking-[0.12em] text-white/35 uppercase">
                {col.heading}
              </p>
              <ul className="mt-2 space-y-1.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[0.7rem] text-white/40 transition hover:text-white/75"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
