/**
 * Amazon "Bounty" referral strip — flat-fee CTAs (Prime free trial, Audible,
 * Music Unlimited, Kindle Unlimited, Amazon Business). Each pays Amazon's
 * fixed bounty amount per qualifying signup, independent of any product
 * purchase.
 *
 * Source of truth is the AffiliateLink table — rows where network='amazon-bounty'.
 * Add bounties via the admin Affiliates manager, paste the bounty URL from
 * Associates Central → Tools → Link Builder → Bounty Programs.
 *
 * Renders nothing if no bounties are configured.
 */

import Link from "next/link";
import { prisma } from "@/lib/prisma";

const PROGRAM_META: Record<
  string,
  { emoji: string; tagline: string; accent: string }
> = {
  prime: { emoji: "📦", tagline: "30-day free trial", accent: "from-blue-500/15 to-blue-500/5" },
  audible: { emoji: "🎧", tagline: "30-day free trial", accent: "from-amber-500/15 to-amber-500/5" },
  music: { emoji: "🎵", tagline: "30-day free trial", accent: "from-pink-500/15 to-pink-500/5" },
  kindle: { emoji: "📚", tagline: "30-day free trial", accent: "from-purple-500/15 to-purple-500/5" },
  business: { emoji: "🏢", tagline: "Free signup", accent: "from-emerald-500/15 to-emerald-500/5" },
  default: { emoji: "🛒", tagline: "Free trial", accent: "from-amber-500/15 to-orange-500/5" },
};

function classify(slug: string, title: string): keyof typeof PROGRAM_META {
  const haystack = `${slug} ${title}`.toLowerCase();
  if (haystack.includes("audible")) return "audible";
  if (haystack.includes("kindle")) return "kindle";
  if (haystack.includes("music")) return "music";
  if (haystack.includes("business")) return "business";
  if (haystack.includes("prime")) return "prime";
  return "default";
}

export default async function AmazonBountyStrip() {
  let bounties: Array<{ shortCode: string; title: string | null }> = [];
  try {
    bounties = await prisma.affiliateLink.findMany({
      where: { network: "amazon-bounty", isActive: true },
      orderBy: [{ clicks: "desc" }, { createdAt: "asc" }],
      take: 6,
      select: { shortCode: true, title: true },
    });
  } catch {
    return null;
  }

  if (bounties.length === 0) return null;

  return (
    <section
      aria-label="Amazon free trials and signups"
      className="mb-4 rounded-xl border border-amber-400/20 bg-gradient-to-r from-amber-500/8 via-orange-500/4 to-transparent p-3"
    >
      <p className="mb-2 text-[0.7rem] uppercase tracking-wide text-amber-200/80">
        Amazon free trials &amp; signups (paid links)
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {bounties.map((b) => {
          const kind = classify(b.shortCode, b.title || "");
          const meta = PROGRAM_META[kind];
          return (
            <Link
              key={b.shortCode}
              href={`/go/${b.shortCode}?src=bounty`}
              prefetch={false}
              rel="nofollow sponsored noopener"
              target="_blank"
              className={`shrink-0 rounded-lg border border-white/10 bg-gradient-to-br ${meta.accent} px-3 py-2 transition hover:border-amber-300/40`}
            >
              <p className="flex items-center gap-1.5 text-sm font-semibold text-white/90">
                <span aria-hidden="true">{meta.emoji}</span>
                {b.title || b.shortCode}
              </p>
              <p className="text-[0.65rem] text-white/55">{meta.tagline}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
