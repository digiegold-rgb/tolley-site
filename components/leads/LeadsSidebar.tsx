"use client";

import { useState, type ReactNode } from "react";
import {
  Sidebar,
  SidebarBrand,
  SidebarSection,
  SidebarLink,
  SidebarFooter,
  type SidebarItem,
} from "@/components/ui/Sidebar";

/**
 * T-Agent left navigation rail. Replaces the old 22-pill two-row topbar.
 *
 * Primary destinations: Cockpit · Pipeline · People · Marketing · Admin
 * Accent shortcuts: Snap & Know (purple), Unclaimed $ (emerald)
 *
 * The "All features" accordion is collapsed by default but still exposes
 * every legacy route so no feature is hidden — it's the user's escape valve
 * for anything Cmd+K doesn't cover.
 */

// Inline icons — small, consistent, no deps.
function I({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const CockpitIcon = (
  <I>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </I>
);

const PipelineIcon = (
  <I>
    <rect x="3" y="5" width="4" height="14" rx="1" />
    <rect x="10" y="5" width="4" height="8" rx="1" />
    <rect x="17" y="5" width="4" height="11" rx="1" />
  </I>
);

const PeopleIcon = (
  <I>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c0-3 2.5-5 6-5s6 2 6 5" />
    <circle cx="17" cy="7" r="2.5" />
    <path d="M15 14.5c1-.3 2-.5 3-.5 2.5 0 3.5 1.5 3.5 3.5" />
  </I>
);

const MarketingIcon = (
  <I>
    <path d="M3 11v3a2 2 0 0 0 2 2h2l6 4V5L7 9H5a2 2 0 0 0-2 2Z" />
    <path d="M16 8a5 5 0 0 1 0 8" />
  </I>
);

const AdminIcon = (
  <I>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .4 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.4 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .4-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.4 1.9V9c.5.2 1 .6 1.3 1.1" />
  </I>
);

const SnapIcon = (
  <I>
    <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z" />
    <circle cx="12" cy="13" r="4" />
  </I>
);

const UnclaimedIcon = (
  <I>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v10" />
    <path d="M15.5 9.5c-.8-1-2-1.5-3.5-1.5-2 0-3.5 1-3.5 2.5s1.5 2 3.5 2.5 3.5 1 3.5 2.5-1.5 2.5-3.5 2.5c-1.5 0-2.7-.5-3.5-1.5" />
  </I>
);

const HelpIcon = (
  <I>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" />
    <circle cx="12" cy="17" r=".5" fill="currentColor" />
  </I>
);

const PRIMARY: SidebarItem[] = [
  {
    href: "/leads",
    label: "Cockpit",
    icon: CockpitIcon,
    match: /^\/leads$/,
  },
  {
    href: "/leads/pipeline",
    label: "Pipeline",
    icon: PipelineIcon,
    match: /^\/leads\/(pipeline|crm|deals|showings|comps)/,
  },
  {
    href: "/leads/people",
    label: "People",
    icon: PeopleIcon,
    match: /^\/leads\/(people|clients|matches|conversations|sms|dashboard|fsbo)/,
  },
  {
    href: "/leads/marketing",
    label: "Marketing",
    icon: MarketingIcon,
    match: /^\/leads\/(marketing|sequences|email|scripts|content|farm-mail|open-house)/,
  },
  {
    href: "/leads/admin",
    label: "Admin",
    icon: AdminIcon,
    match: /^\/leads\/(admin|settings|connects|analytics|workflow|pricing|narrpr)/,
  },
];

const SHORTCUTS: SidebarItem[] = [
  {
    href: "/leads/snap",
    label: "Snap & Know",
    icon: SnapIcon,
    accent: "purple",
  },
  {
    href: "/leads/unclaimed",
    label: "Unclaimed $",
    icon: UnclaimedIcon,
    accent: "emerald",
  },
];

// Every current route, grouped by job. Used by the Legacy section so no
// feature is hidden during the transition.
const LEGACY_GROUPS: Array<{ label: string; items: SidebarItem[] }> = [
  {
    label: "Lead Work",
    items: [
      { href: "/leads/dashboard", label: "Lead dashboard" },
      { href: "/leads/crm", label: "CRM kanban" },
      { href: "/leads/deals", label: "Deals tracker" },
      { href: "/leads/clients", label: "Clients" },
      { href: "/leads/matches", label: "Matches" },
      { href: "/leads/dossier", label: "Dossiers" },
      { href: "/leads/comps", label: "Comps / CMA" },
      { href: "/leads/conversations", label: "SMS inbox" },
      { href: "/leads/showings", label: "Showings" },
    ],
  },
  {
    label: "Acquisition",
    items: [
      { href: "/leads/fsbo", label: "FSBO finder" },
      { href: "/leads/narrpr", label: "NARRPR import" },
      { href: "/leads/unclaimed", label: "Unclaimed funds" },
      { href: "/leads/snap", label: "Snap & Know" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/leads/sequences", label: "SMS sequences" },
      { href: "/leads/email", label: "Email sequences" },
      { href: "/leads/scripts", label: "Scripts library" },
      { href: "/leads/content", label: "Content hub" },
      { href: "/leads/farm-mail", label: "Farm mail" },
      { href: "/leads/open-house", label: "Open house" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/leads/analytics", label: "Analytics" },
      { href: "/leads/workflow", label: "Workflow editor" },
      { href: "/leads/connects", label: "Integrations" },
      { href: "/leads/settings", label: "Settings" },
      { href: "/leads/pricing", label: "Billing" },
      { href: "/leads/onboard", label: "Onboarding" },
    ],
  },
];

export default function LeadsSidebar({
  tier,
}: {
  tier?: string | null;
}) {
  const [legacyOpen, setLegacyOpen] = useState(false);

  return (
    <Sidebar className="sticky top-0 h-screen overflow-y-auto">
      <SidebarBrand href="/leads">
        <span className="text-white/80">t-agent</span>
        {tier && (
          <span className="ml-auto rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-purple-300">
            {tier}
          </span>
        )}
      </SidebarBrand>

      <SidebarSection label="Workspace">
        {PRIMARY.map((item) => (
          <SidebarLink key={item.href} item={item} />
        ))}
      </SidebarSection>

      <SidebarSection label="Shortcuts">
        {SHORTCUTS.map((item) => (
          <SidebarLink key={item.href} item={item} />
        ))}
      </SidebarSection>

      <div className="px-2">
        <button
          onClick={() => setLegacyOpen((o) => !o)}
          className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-white/30 hover:text-white/60"
        >
          <span>All features</span>
          <span>{legacyOpen ? "\u2212" : "+"}</span>
        </button>
        {legacyOpen && (
          <div className="space-y-3 pb-3">
            {LEGACY_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="mb-1 px-3 text-[10px] text-white/20">
                  {group.label}
                </div>
                <nav className="space-y-0.5">
                  {group.items.map((item) => (
                    <SidebarLink key={item.href} item={item} compact />
                  ))}
                </nav>
              </div>
            ))}
          </div>
        )}
      </div>

      <SidebarFooter>
        <a
          href="/leads/_dev/primitives"
          className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60"
        >
          <span className="flex h-4 w-4 items-center justify-center">
            {HelpIcon}
          </span>
          <span>Help &amp; shortcuts</span>
        </a>
      </SidebarFooter>
    </Sidebar>
  );
}
