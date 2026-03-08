import Link from "next/link";

import { TR_COMPANY, TR_CONTACT_EMAIL, TR_CONTACT_PHONE, TR_FACEBOOK_URL } from "@/lib/trailer";

export function TrailerFooter() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-4 pb-10 sm:px-8">
      <div className="border-t border-neutral-800 pt-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-black tracking-wide text-white uppercase">{TR_COMPANY}</p>
            <p className="mt-1 text-sm font-light text-neutral-500">
              <a href={`mailto:${TR_CONTACT_EMAIL}`} className="transition hover:text-amber-400">
                {TR_CONTACT_EMAIL}
              </a>
              {" \u00B7 "}
              <a href={`tel:${TR_CONTACT_PHONE}`} className="transition hover:text-amber-400">
                {TR_CONTACT_PHONE}
              </a>
            </p>
          </div>
          <nav className="flex items-center gap-3 text-sm text-neutral-500">
            <Link href="/trailer/terms" className="transition hover:text-amber-400">
              Rental Terms
            </Link>
            <span className="text-neutral-700">|</span>
            <Link href="/trailer/privacy" className="transition hover:text-amber-400">
              Privacy
            </Link>
            <span className="text-neutral-700">|</span>
            <a
              href={TR_FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition hover:text-amber-400"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook
            </a>
          </nav>
        </div>
        <div className="mt-4 rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-4 py-2.5 text-center">
          <p className="text-xs font-bold tracking-wider text-amber-400/70 uppercase">
            Need a generator?{" "}
            <Link href="/generator" className="text-amber-400 transition hover:text-amber-300">
              Check out our generator rental &rarr;
            </Link>
          </p>
        </div>
        <p className="mt-4 text-center text-sm font-light text-neutral-600">
          Built for workers, by workers.
        </p>
      </div>
    </footer>
  );
}
