import Link from "next/link";
import { POOLS_COMPANY, POOLS_CONTACT_EMAIL, POOLS_CONTACT_PHONE } from "@/lib/pools";

export function PoolsFooter() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-4 pb-10 sm:px-8">
      <div className="border-t border-cyan-200 pt-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-semibold text-cyan-900">{POOLS_COMPANY}</p>
            <p className="mt-1 text-sm text-slate-500">
              <a
                href={`mailto:${POOLS_CONTACT_EMAIL}`}
                className="transition hover:text-cyan-600"
              >
                {POOLS_CONTACT_EMAIL}
              </a>
              {" \u00B7 "}
              <a
                href={`tel:${POOLS_CONTACT_PHONE}`}
                className="transition hover:text-cyan-600"
              >
                {POOLS_CONTACT_PHONE}
              </a>
            </p>
          </div>
          <nav className="flex items-center gap-3 text-sm text-slate-500">
            <Link
              href="/privacy"
              className="transition hover:text-cyan-600"
            >
              Privacy Policy
            </Link>
            <span className="text-cyan-200">|</span>
            <Link
              href="/terms"
              className="transition hover:text-cyan-600"
            >
              Terms
            </Link>
            <span className="text-cyan-200">|</span>
            <Link
              href="/start"
              className="transition hover:text-cyan-600"
            >
              All Services
            </Link>
          </nav>
        </div>
        <p className="mt-4 text-center text-sm text-slate-400">
          Pool supplies at contractor pricing, delivered to your door.
        </p>
      </div>
    </footer>
  );
}
