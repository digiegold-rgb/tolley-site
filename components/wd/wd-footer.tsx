import Link from "next/link";

import { WD_COMPANY, WD_CONTACT_EMAIL, WD_CONTACT_PHONE } from "@/lib/wd";

export function WdFooter() {
  return (
    <footer className="relative z-20 mx-auto w-full max-w-6xl px-5 pt-8 pb-10 sm:px-8">
      <div className="border-t border-white/12 pt-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-sm font-semibold text-white/80">{WD_COMPANY}</p>
            <p className="mt-1 text-xs text-white/50">
              <a
                href={`mailto:${WD_CONTACT_EMAIL}`}
                className="transition hover:text-white/80"
              >
                {WD_CONTACT_EMAIL}
              </a>
              {" · "}
              <a
                href={`tel:${WD_CONTACT_PHONE}`}
                className="transition hover:text-white/80"
              >
                {WD_CONTACT_PHONE}
              </a>
            </p>
          </div>
          <nav className="flex items-center gap-3 text-xs text-white/50">
            <Link href="/wd/terms" className="transition hover:text-white/80">
              Rental Agreement
            </Link>
            <span className="text-white/30">|</span>
            <Link href="/wd/privacy" className="transition hover:text-white/80">
              Privacy Policy
            </Link>
          </nav>
        </div>
        <p className="mt-4 text-center text-xs text-white/40">
          Thank you for supporting local.
        </p>
      </div>
    </footer>
  );
}
