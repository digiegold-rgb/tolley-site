import Link from "next/link";

import { RENTAL_COMPANY, RENTAL_CONTACT_EMAIL, RENTAL_CONTACT_PHONE } from "@/lib/rental";

export function RentalFooter() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-4 pb-10 sm:px-8">
      <div className="border-t border-slate-700/50 pt-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-black tracking-wide text-white uppercase">{RENTAL_COMPANY}</p>
            <p className="mt-1 text-sm font-light text-slate-500">
              <a href={`mailto:${RENTAL_CONTACT_EMAIL}`} data-track-event="email_click" data-track-label="rental_footer" className="transition hover:text-teal-400">
                {RENTAL_CONTACT_EMAIL}
              </a>
              {" \u00B7 "}
              <a href={`tel:${RENTAL_CONTACT_PHONE}`} data-track-event="phone_click" data-track-label="rental_footer" className="transition hover:text-teal-400">
                {RENTAL_CONTACT_PHONE}
              </a>
            </p>
          </div>
          <nav className="flex items-center gap-3 text-sm text-slate-500">
            <Link href="/rental/terms" className="transition hover:text-teal-400">
              Rental Terms
            </Link>
            <span className="text-slate-700">|</span>
            <Link href="/trailer/privacy" className="transition hover:text-teal-400">
              Privacy
            </Link>
          </nav>
        </div>

        <p className="mt-4 text-center text-sm font-light text-slate-600">
          Rent what you need. We&rsquo;ve got it.
        </p>
      </div>
    </footer>
  );
}
