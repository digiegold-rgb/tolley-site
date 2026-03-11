import Link from "next/link";

import {
  HVAC_BRAND,
  HVAC_PHONE,
  HVAC_PHONE_RAW,
  HVAC_EMAIL,
  HVAC_ADDRESS,
  HVAC_HOURS,
  HVAC_FACEBOOK,
  HVAC_WEBSITE,
} from "@/lib/hvac";

export function HvacFooter() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-4 pb-10 sm:px-8">
      <div className="border-t border-cyan-400/15 pt-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-bold tracking-wide text-white uppercase">{HVAC_BRAND}</p>
            <p className="mt-1 text-sm text-neutral-500">
              {HVAC_ADDRESS}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              <a href={`tel:${HVAC_PHONE_RAW}`} className="transition hover:text-cyan-400">
                {HVAC_PHONE}
              </a>
              {" \u00B7 "}
              <a href={`mailto:${HVAC_EMAIL}`} className="transition hover:text-cyan-400">
                {HVAC_EMAIL}
              </a>
            </p>
            <p className="mt-1 text-sm font-semibold text-orange-400">{HVAC_HOURS}</p>
          </div>
          <nav className="flex items-center gap-3 text-sm text-neutral-500">
            <a
              href={HVAC_FACEBOOK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition hover:text-cyan-400"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook
            </a>
            <span className="text-neutral-700">|</span>
            <a
              href={HVAC_WEBSITE}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-cyan-400"
            >
              Website
            </a>
          </nav>
        </div>
        <div className="mt-4 text-center">
          <p className="text-xs text-neutral-600">
            Powered by{" "}
            <Link href="/" className="text-cyan-400/60 transition hover:text-cyan-400">
              tolley.io
            </Link>
          </p>
        </div>
        <p className="mt-3 text-center text-sm font-light text-neutral-600">
          It&apos;s time to be cool.
        </p>
      </div>
    </footer>
  );
}
