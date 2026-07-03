"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";

/**
 * Admin workspace (Phase 7). URL-synced tabs for: Billing · Integrations ·
 * MLS Auth · Settings · Analytics · Workflow · Logs. Each tab is a curated
 * launcher that opens the full-featured existing page without losing the
 * T-Agent sidebar+topbar chrome.
 */

interface AdminFeature {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  accent: "purple" | "blue" | "emerald" | "yellow" | "pink";
}

const FEATURES: AdminFeature[] = [
  {
    id: "billing",
    title: "Billing & Plans",
    description:
      "Stripe subscription, tier upgrade, SMS credits, agent seats, payment methods, invoices.",
    href: "/leads/pricing",
    accent: "purple",
    icon: <Icon path="M2 7h20v10H2z M2 12h20 M7 16h2 M12 16h2" />,
  },
  {
    id: "integrations",
    title: "Integrations",
    description:
      "Connect Twilio A2P, MLS Grid, NARRPR, Remine, Facebook Business, Google My Business, Stripe.",
    href: "/leads/connects",
    accent: "blue",
    icon: <Icon path="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />,
  },
  {
    id: "mls",
    title: "MLS Session Hub",
    description:
      "Heartland MLS Clareity SSO, Matrix-Tax, Remine, RPR, Realist, Cloud CMA — all unlocked by one login.",
    href: "/leads/connects",
    accent: "emerald",
    icon: <Icon path="M12 2 4 6v12l8 4 8-4V6l-8-4z M4 6l8 4 8-4 M12 10v12" />,
  },
  {
    id: "settings",
    title: "Settings & Farm Area",
    description:
      "Farm zip codes, specialties, auto-responder, SMS quota, business hours, DNC list.",
    href: "/leads/settings",
    accent: "yellow",
    icon: <Icon path="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />,
  },
  {
    id: "analytics",
    title: "Analytics & ROI",
    description:
      "Contacts, SMS engagement, conversion funnel, campaign ROI, source attribution, tier utilization.",
    href: "/leads/analytics",
    accent: "blue",
    icon: <Icon path="M3 3v18h18 M7 16l4-4 4 4 5-7" />,
  },
  {
    id: "workflow",
    title: "Workflow Editor",
    description:
      "Drag-and-drop DAG builder for the 15-plugin dossier pipeline. Customize research flows per farm area.",
    href: "/leads/workflow",
    accent: "pink",
    icon: <Icon path="M6 3v12a3 3 0 0 0 3 3h6 M18 21v-6 M15 18l3 3 3-3 M6 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />,
  },
  {
    id: "markets",
    title: "Market Intelligence",
    description:
      "Housing market signals, mortgage rates, FRED economic data, RSS news, YouTube transcript analysis.",
    href: "/leads/markets",
    accent: "emerald",
    icon: <Icon path="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z M3 12h18 M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />,
  },
];

export default function AdminTabs() {
  return (
    <Tabs defaultValue="billing" syncUrl="tab">
      <TabList className="mb-5 overflow-x-auto">
        {FEATURES.map((feature) => (
          <TabTrigger key={feature.id} value={feature.id}>
            {feature.title.split(" ")[0]}
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

function FeatureLauncher({ feature }: { feature: AdminFeature }) {
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
            <span>Open {feature.title.split(" ")[0]}</span>
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
