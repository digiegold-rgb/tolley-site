import Link from "next/link";
import { buildDirectory } from "@/lib/directory";

/**
 * The local-services off-ramp. 60% of site traffic lands on this homepage,
 * but most of it is local/social visitors looking for services, not the
 * T-Agent SaaS — this band routes them into the network (with ?ref=home
 * attribution) instead of letting them bounce. One strip, registry-driven;
 * the SaaS page below stays untouched.
 */

const QUICK_PICKS = ["homes", "wd", "lastmile", "shop", "pools", "cleanouts"];

export function HpCircleBand() {
  const byName = new Map(buildDirectory().map((e) => [e.name, e]));
  const picks = QUICK_PICKS.map((n) => byName.get(n)).filter(
    (e): e is NonNullable<typeof e> => Boolean(e),
  );
  if (picks.length === 0) return null;

  return (
    <section
      aria-label="Local services from Tolley.io"
      className="relative z-10 border-y border-purple-500/20 bg-purple-500/[0.06] px-5 py-5"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-center text-sm font-semibold text-white sm:text-left">
          Here for rentals, homes, hauling, or deals?{" "}
          <span className="text-neutral-400">That&apos;s me too —</span>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {picks.map((e) => (
            <Link
              key={e.name}
              href={`${e.url}?ref=home`}
              className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-white/40"
            >
              {e.emoji} {e.title.replace(/ KC$| Kansas City.*$/i, "")}
            </Link>
          ))}
          <Link
            href="/circle"
            className="rounded-full bg-purple-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-purple-400"
          >
            ⭕ Everything
          </Link>
        </div>
      </div>
    </section>
  );
}
