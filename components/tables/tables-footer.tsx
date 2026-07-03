import Link from "next/link";

import { TBL_COMPANY, TBL_CONTACT_EMAIL, TBL_CONTACT_PHONE, TBL_FACEBOOK_URLS } from "@/lib/tables";

export function TablesFooter() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-4 pb-10 sm:px-8">
      <div className="border-t border-slate-700/50 pt-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-black tracking-wide text-white uppercase">{TBL_COMPANY}</p>
            <p className="mt-1 text-sm font-light text-slate-500">
              <a href={`mailto:${TBL_CONTACT_EMAIL}`} data-track-event="email_click" data-track-label="tables_footer" className="transition hover:text-[#c8a84e]">
                {TBL_CONTACT_EMAIL}
              </a>
              {" \u00B7 "}
              <a href={`tel:${TBL_CONTACT_PHONE}`} data-track-event="phone_click" data-track-label="tables_footer" className="transition hover:text-[#c8a84e]">
                {TBL_CONTACT_PHONE}
              </a>
            </p>
          </div>
          <nav className="flex items-center gap-3 text-sm text-slate-500">
            <Link href="/rental/terms" className="transition hover:text-[#c8a84e]">
              Rental Terms
            </Link>
            <span className="text-slate-700">|</span>
            <Link href="/trailer/privacy" className="transition hover:text-[#c8a84e]">
              Privacy
            </Link>
            <span className="text-slate-700">|</span>
            <a
              href={TBL_FACEBOOK_URLS[0]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition hover:text-[#c8a84e]"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook
            </a>
          </nav>
        </div>

        {/* Cross-sell */}
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <div className="rounded-lg border border-teal-500/15 bg-teal-500/[0.04] px-4 py-2.5 text-center">
            <p className="text-xs font-bold tracking-wider text-teal-400/70 uppercase">
              See all rentals{" "}
              <Link href="/rental" className="text-teal-400 transition hover:text-teal-300">
                Browse rentals &rarr;
              </Link>
            </p>
          </div>
          <div className="rounded-lg border border-[#e040a0]/15 bg-[#e040a0]/[0.04] px-4 py-2.5 text-center">
            <p className="text-xs font-bold tracking-wider text-[#e040a0]/70 uppercase">
              Party game?{" "}
              <Link href="/kerplunk" className="text-[#e040a0] transition hover:text-[#e88dc0]">
                Giant Kerplunk &rarr;
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-sm font-light text-slate-600">
          Tables &amp; Chairs. For any event.
        </p>
      </div>
    </footer>
  );
}
