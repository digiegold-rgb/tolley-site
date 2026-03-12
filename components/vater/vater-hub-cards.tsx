import Link from "next/link";
import { VATER_VENTURES } from "@/lib/vater";

export function VaterHubCards() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {VATER_VENTURES.map((v) => (
          <Link
            key={v.slug}
            href={v.href}
            className="vater-card vater-venture-card group flex flex-col p-6"
          >
            {/* Icon + Title */}
            <div className="mb-3 flex items-center gap-3">
              <span className="text-3xl" role="img" aria-label={v.title}>
                {v.icon}
              </span>
              <div>
                <h2 className="text-xl font-bold text-slate-100">{v.title}</h2>
                <p className="text-sm text-slate-400">{v.subtitle}</p>
              </div>
            </div>

            {/* Description */}
            <p className="mb-4 flex-1 text-sm leading-relaxed text-slate-400">
              {v.description}
            </p>

            {/* Badges */}
            <div className="mb-4 flex flex-wrap gap-2">
              {v.badges.map((badge) => (
                <span key={badge} className="vater-badge">
                  {badge}
                </span>
              ))}
            </div>

            {/* Arrow link */}
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-sky-400 transition-transform group-hover:translate-x-1">
              Explore runway
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
