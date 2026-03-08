import { WD_STRIPE_CHECKOUT_URL, WD_STRIPE_PORTAL_URL } from "@/lib/wd";

export function WdHero() {
  return (
    <header className="rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(45,175,180,0.1)),rgba(8,7,15,0.58)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl sm:p-8">
      <p className="text-[0.72rem] font-medium tracking-[0.42em] text-white/68 uppercase">
        Your KC Homes LLC
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-white/95 sm:text-4xl">
        Skip the Laundromat.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
        Washer &amp; dryer rentals delivered to your door. Free install, maintenance
        included, no contracts. Kansas City metro.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs tracking-[0.1em] text-white/60 uppercase">
        <span className="rounded-full border border-white/18 bg-black/25 px-3 py-1">
          Free Delivery &amp; Install
        </span>
        <span className="rounded-full border border-white/18 bg-black/25 px-3 py-1">
          Kansas City Local
        </span>
        <span className="rounded-full border border-white/18 bg-black/25 px-3 py-1">
          Cancel Anytime
        </span>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={WD_STRIPE_CHECKOUT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(45,175,180,0.35)] transition hover:bg-teal-500"
        >
          Start Renting
        </a>
        <a
          href={WD_STRIPE_PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/10"
        >
          Manage My Account
        </a>
      </div>
    </header>
  );
}
