import Link from "next/link";

import { PT_COMPANY, PT_CONTACT_EMAIL, PT_CONTACT_PHONE } from "@/lib/picnic-table";

export function PicnicFooter() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-4 pb-10 sm:px-8">
      <div className="border-t border-slate-700/50 pt-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-black tracking-wide text-white uppercase">{PT_COMPANY}</p>
            <p className="mt-1 text-sm font-light text-slate-500">
              <a href={`mailto:${PT_CONTACT_EMAIL}`} data-track-event="email_click" data-track-label="picnic_footer" className="transition hover:text-[#c4a56e]">
                {PT_CONTACT_EMAIL}
              </a>
              {" \u00B7 "}
              <a href={`tel:${PT_CONTACT_PHONE}`} data-track-event="phone_click" data-track-label="picnic_footer" className="transition hover:text-[#c4a56e]">
                {PT_CONTACT_PHONE}
              </a>
            </p>
          </div>
          <nav className="flex items-center gap-3 text-sm text-slate-500">
            <Link href="/rental/terms" className="transition hover:text-[#c4a56e]">
              Rental Terms
            </Link>
            <span className="text-slate-700">|</span>
            <Link href="/trailer/privacy" className="transition hover:text-[#c4a56e]">
              Privacy
            </Link>
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
          <div className="rounded-lg border border-[#c8a84e]/15 bg-[#c8a84e]/[0.04] px-4 py-2.5 text-center">
            <p className="text-xs font-bold tracking-wider text-[#c8a84e]/70 uppercase">
              Need tables?{" "}
              <Link href="/tables" className="text-[#c8a84e] transition hover:text-[#dbc278]">
                Tables &amp; Chairs &rarr;
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-sm font-light text-slate-600">
          Take it outside.
        </p>
      </div>
    </footer>
  );
}
