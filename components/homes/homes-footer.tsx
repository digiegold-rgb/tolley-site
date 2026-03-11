import Link from "next/link";

import { HM_AGENT_NAME, HM_COMPANY, HM_CONTACT_EMAIL, HM_CONTACT_PHONE, HM_URE_URL } from "@/lib/homes";

export function HomesFooter() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-4 pb-10 sm:px-8">
      <div className="border-t border-neutral-800 pt-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-extrabold tracking-wide text-white uppercase">{HM_AGENT_NAME}</p>
            <p className="text-sm text-neutral-500">{HM_COMPANY}</p>
            <p className="mt-1 text-sm font-light text-neutral-500">
              <a href={`mailto:${HM_CONTACT_EMAIL}`} className="transition hover:text-sky-400">
                {HM_CONTACT_EMAIL}
              </a>
              {" \u00B7 "}
              <a href={`tel:${HM_CONTACT_PHONE}`} className="transition hover:text-sky-400">
                {HM_CONTACT_PHONE}
              </a>
            </p>
          </div>
          <nav className="flex items-center gap-3 text-sm text-neutral-500">
            <a
              href={HM_URE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-sky-400"
            >
              Search Homes
            </a>
            <span className="text-neutral-700">|</span>
            <Link href="/trailer" className="transition hover:text-sky-400">
              Trailer Rental
            </Link>
            <span className="text-neutral-700">|</span>
            <Link href="/generator" className="transition hover:text-sky-400">
              Generator
            </Link>
          </nav>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link
            href="/trailer"
            className="rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-4 py-2 text-xs font-bold tracking-wider text-amber-400/70 uppercase transition hover:text-amber-300"
          >
            Rent a Trailer &rarr;
          </Link>
          <Link
            href="/wd"
            className="rounded-lg border border-blue-500/15 bg-blue-500/[0.04] px-4 py-2 text-xs font-bold tracking-wider text-blue-400/70 uppercase transition hover:text-blue-300"
          >
            Washer &amp; Dryer Rental &rarr;
          </Link>
          <Link
            href="/generator"
            className="rounded-lg border border-yellow-500/15 bg-yellow-500/[0.04] px-4 py-2 text-xs font-bold tracking-wider text-yellow-400/70 uppercase transition hover:text-yellow-300"
          >
            Generator Rental &rarr;
          </Link>
          <Link
            href="/lastmile"
            className="rounded-lg border border-red-500/15 bg-red-500/[0.04] px-4 py-2 text-xs font-bold tracking-wider text-red-400/70 uppercase transition hover:text-red-300"
          >
            Last-Mile Delivery &rarr;
          </Link>
        </div>

        <p className="mt-4 text-center text-sm font-light text-neutral-600">
          Local expertise. Powered by technology.
        </p>
      </div>
    </footer>
  );
}
