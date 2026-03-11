import Link from "next/link";

import {
  LM_COMPANY,
  LM_EMAIL,
  LM_FACEBOOK,
  LM_HOURS,
  LM_LOCATION,
  LM_PHONE,
  LM_PHONE_RAW,
} from "@/lib/lastmile";

const CROSS_LINKS = [
  { label: "Need a trailer?", href: "/trailer", color: "amber" },
  { label: "Need a generator?", href: "/generator", color: "yellow" },
  { label: "Moving supplies?", href: "/moving", color: "emerald" },
  { label: "Washer/dryer rental?", href: "/wd", color: "blue" },
  { label: "Real estate?", href: "/homes", color: "sky" },
  { label: "HVAC service?", href: "/hvac", color: "cyan" },
] as const;

const COLOR_MAP: Record<string, string> = {
  amber: "border-amber-500/15 bg-amber-500/[0.04] text-amber-400/70 hover:text-amber-300",
  yellow: "border-yellow-500/15 bg-yellow-500/[0.04] text-yellow-400/70 hover:text-yellow-300",
  emerald: "border-emerald-500/15 bg-emerald-500/[0.04] text-emerald-400/70 hover:text-emerald-300",
  blue: "border-blue-500/15 bg-blue-500/[0.04] text-blue-400/70 hover:text-blue-300",
  sky: "border-sky-500/15 bg-sky-500/[0.04] text-sky-400/70 hover:text-sky-300",
  cyan: "border-cyan-500/15 bg-cyan-500/[0.04] text-cyan-400/70 hover:text-cyan-300",
};

export function LmFooter() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-4 pb-10 sm:px-8">
      <div className="border-t border-red-500/15 pt-6">
        {/* Contact row */}
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-bold tracking-wide text-white uppercase">{LM_COMPANY}</p>
            <p className="mt-1 text-sm text-neutral-500">{LM_LOCATION}</p>
            <p className="mt-1 text-sm text-neutral-500">
              <a href={`tel:${LM_PHONE_RAW}`} className="transition hover:text-red-400">
                {LM_PHONE}
              </a>
              {" \u00B7 "}
              <a href={`mailto:${LM_EMAIL}`} className="transition hover:text-red-400">
                {LM_EMAIL}
              </a>
            </p>
            <p className="mt-1 text-sm font-semibold text-amber-400">{LM_HOURS}</p>
          </div>
          <nav className="flex items-center gap-3 text-sm text-neutral-500">
            <a
              href={LM_FACEBOOK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition hover:text-red-400"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook
            </a>
          </nav>
        </div>

        {/* Cross-sell links */}
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {CROSS_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg border px-4 py-2 text-xs font-bold tracking-wider uppercase transition ${COLOR_MAP[link.color]}`}
            >
              {link.label} &rarr;
            </Link>
          ))}
        </div>

        {/* Powered by */}
        <div className="mt-4 text-center">
          <p className="text-xs text-neutral-600">
            Powered by{" "}
            <Link href="/" className="text-red-400/60 transition hover:text-red-400">
              tolley.io
            </Link>
          </p>
        </div>

        <p className="mt-3 text-center text-sm font-light text-neutral-600">
          Fast. Done.
        </p>
      </div>
    </footer>
  );
}
