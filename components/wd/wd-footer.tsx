import Link from "next/link";

import { WD_COMPANY, WD_CONTACT_EMAIL, WD_CONTACT_PHONE, WD_FACEBOOK_URL } from "@/lib/wd";

export function WdFooter() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-4 pb-10 sm:px-8">
      <div className="border-t border-blue-200 pt-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-semibold text-blue-900">{WD_COMPANY}</p>
            <p className="mt-1 text-sm text-slate-500">
              <a
                href={`mailto:${WD_CONTACT_EMAIL}`}
                data-track-event="email_click"
                data-track-label="footer"
                className="transition hover:text-blue-600"
              >
                {WD_CONTACT_EMAIL}
              </a>
              {" \u00B7 "}
              <a
                href={`tel:${WD_CONTACT_PHONE}`}
                data-track-event="phone_click"
                data-track-label="footer"
                className="transition hover:text-blue-600"
              >
                {WD_CONTACT_PHONE}
              </a>
            </p>
          </div>
          <nav className="flex items-center gap-3 text-sm text-slate-500">
            <Link
              href="/wd/terms"
              className="transition hover:text-blue-600"
            >
              Rental Agreement
            </Link>
            <span className="text-blue-200">|</span>
            <Link
              href="/wd/privacy"
              className="transition hover:text-blue-600"
            >
              Privacy Policy
            </Link>
            <span className="text-blue-200">|</span>
            <a
              href={WD_FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition hover:text-blue-600"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook
            </a>
          </nav>
        </div>
        <p className="mt-4 text-center text-sm text-slate-400">
          Thank you for supporting local.
        </p>
      </div>
    </footer>
  );
}
