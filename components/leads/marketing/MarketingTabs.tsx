"use client";

import Link from "next/link";
import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import type { ReactNode } from "react";

/**
 * Marketing workspace (Phase 6). Rather than rewriting 7 full-featured pages
 * to fit inside tab panels, this page acts as a curated launcher with tab-
 * style navigation. Each tab describes the feature and links to the existing
 * route, which still works inside the T-Agent shell (sidebar + topbar).
 *
 * This keeps every feature 1:1 functional while giving Cordless a single
 * place that shows "everything marketing" at a glance. In a later pass we
 * can migrate the bodies inline once the primitives are more battle-tested.
 */

interface MarketingFeature {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  accent: "purple" | "blue" | "emerald" | "yellow" | "pink";
}

const FEATURES: MarketingFeature[] = [
  {
    id: "sequences",
    title: "SMS Sequences",
    description:
      "AI-authored drip campaigns. Multi-step with delay rules, auto-enrollment by source, A2P 10DLC compliant.",
    href: "/leads/sequences",
    accent: "blue",
    icon: <Icon path="M3 3h18v18H3z M3 9h18 M9 21V9" />,
  },
  {
    id: "email",
    title: "Email Sequences",
    description:
      "Multi-touch email drip campaigns with template editor, merge tags, and open/click tracking.",
    href: "/leads/email",
    accent: "purple",
    icon: <Icon path="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M22 6l-10 7L2 6" />,
  },
  {
    id: "scripts",
    title: "Scripts Library",
    description:
      "Talk tracks by scenario — expired listings, FSBOs, divorce, tax lien, probate. Rehearsable and editable.",
    href: "/leads/scripts",
    accent: "yellow",
    icon: <Icon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5" />,
  },
  {
    id: "content",
    title: "Content Studio",
    description:
      "Posts, templates, campaigns, and social-platform connections. 11-section distribution suite.",
    href: "/leads/content",
    accent: "emerald",
    icon: <Icon path="M12 2 4 6v12l8 4 8-4V6l-8-4z M12 2v20 M4 6l8 4 8-4" />,
  },
  {
    id: "farm-mail",
    title: "Farm Mail Campaigns",
    description:
      "Direct-mail farming — ZIP targeting, mailer templates, print-vendor handoff, response tracking.",
    href: "/leads/farm-mail",
    accent: "pink",
    icon: <Icon path="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-9 6-9-6Z M21 7l-9 6-9-6Z" />,
  },
  {
    id: "open-house",
    title: "Open House",
    description:
      "Sign-in sheet, QR code, photo uploads, follow-up drip auto-enrollment, attendee CRM import.",
    href: "/leads/open-house",
    accent: "blue",
    icon: <Icon path="M3 12 12 3l9 9v9a2 2 0 0 1-2 2h-4v-7H10v7H6a2 2 0 0 1-2-2v-9z" />,
  },
  {
    id: "fsbo",
    title: "FSBO Finder",
    description:
      "Scraped For-Sale-By-Owner listings from Craigslist, Zillow, and public records. Enriched + scored.",
    href: "/leads/fsbo",
    accent: "yellow",
    icon: <Icon path="M3 21V8l9-5 9 5v13 M9 21v-8h6v8" />,
  },
];

export default function MarketingTabs() {
  return (
    <Tabs defaultValue="sequences" syncUrl="tab">
      <TabList className="mb-5 overflow-x-auto">
        {FEATURES.map((feature) => (
          <TabTrigger key={feature.id} value={feature.id}>
            {feature.title.replace(/ .+$/, "")}
          </TabTrigger>
        ))}
      </TabList>

      {FEATURES.map((feature) => (
        <TabPanel key={feature.id} value={feature.id}>
          <FeatureLauncher feature={feature} />
        </TabPanel>
      ))}
    </Tabs>
  );
}

function FeatureLauncher({ feature }: { feature: MarketingFeature }) {
  const accentBg = {
    purple: "from-purple-500/15",
    blue: "from-blue-500/15",
    emerald: "from-emerald-500/15",
    yellow: "from-yellow-500/15",
    pink: "from-pink-500/15",
  }[feature.accent];

  const accentBtn = {
    purple: "border-purple-500/30 bg-purple-500/15 text-purple-200 hover:bg-purple-500/25",
    blue: "border-blue-500/30 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25",
    emerald: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25",
    yellow: "border-yellow-500/30 bg-yellow-500/15 text-yellow-200 hover:bg-yellow-500/25",
    pink: "border-pink-500/30 bg-pink-500/15 text-pink-200 hover:bg-pink-500/25",
  }[feature.accent];

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-gradient-to-br ${accentBg} to-white/[0.02] p-8`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-white/70">
          {feature.icon}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-white">{feature.title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            {feature.description}
          </p>
          <Link
            href={feature.href}
            className={`mt-5 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${accentBtn}`}
          >
            <span>Open {feature.title}</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="22"
      height="22"
      aria-hidden
    >
      {path
        .split(" M")
        .map((p, i) => (i === 0 ? p : "M" + p))
        .map((segment, i) => (
          <path key={i} d={segment} />
        ))}
    </svg>
  );
}
