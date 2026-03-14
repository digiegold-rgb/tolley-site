import Link from "next/link";
import { VIDEO_COMPANY, VIDEO_CONTACT_EMAIL, VIDEO_CONTACT_PHONE } from "@/lib/video";

export function VideoFooter() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-4 pb-10 sm:px-8">
      <div className="border-t border-slate-700/50 pt-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-black tracking-wide text-white uppercase">{VIDEO_COMPANY}</p>
            <p className="mt-1 text-sm font-light text-slate-500">
              <a href={`mailto:${VIDEO_CONTACT_EMAIL}`} className="transition hover:text-purple-400">
                {VIDEO_CONTACT_EMAIL}
              </a>
              {" \u00B7 "}
              <a href={`tel:${VIDEO_CONTACT_PHONE}`} className="transition hover:text-purple-400">
                {VIDEO_CONTACT_PHONE}
              </a>
            </p>
          </div>
          <nav className="flex items-center gap-3 text-sm text-slate-500">
            <Link href="/terms" className="transition hover:text-purple-400">
              Terms
            </Link>
            <span className="text-slate-700">|</span>
            <Link href="/privacy" className="transition hover:text-purple-400">
              Privacy
            </Link>
            <span className="text-slate-700">|</span>
            <Link href="/start" className="transition hover:text-purple-400">
              All Services
            </Link>
          </nav>
        </div>

        {/* Cross-sell */}
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <div className="rounded-lg border border-sky-500/15 bg-sky-500/[0.04] px-4 py-2.5 text-center">
            <p className="text-xs font-bold tracking-wider text-sky-400/70 uppercase">
              Selling a home?{" "}
              <Link href="/homes" className="text-sky-400 transition hover:text-sky-300">
                Real Estate &rarr;
              </Link>
            </p>
          </div>
          <div className="rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-4 py-2.5 text-center">
            <p className="text-xs font-bold tracking-wider text-amber-400/70 uppercase">
              Need a trailer?{" "}
              <Link href="/trailer" className="text-amber-400 transition hover:text-amber-300">
                Trailer Rentals &rarr;
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-sm font-light text-slate-600">
          Powered by Wan 2.6 &amp; Google Veo 3. Built in Kansas City.
        </p>
      </div>
    </footer>
  );
}
