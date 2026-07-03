/**
 * T-Agent command registry (Phase 8).
 *
 * Source of truth for every Cmd+K command and every Quick Action / AI chat
 * shortcut. Commands are defined as plain data so they can be enumerated by
 * the AI chat pane, the Cockpit Quick Actions grid, and the palette itself.
 *
 * Run-time note: commands that need the router, toaster, or current pathname
 * receive a CommandContext rather than importing those directly. The
 * provider (see `app/leads/layout.tsx`) constructs the context on every
 * render and feeds the registry into `<CommandPaletteProvider>`.
 */

import type { Command } from "@/components/ui/CommandPalette";

export interface CommandContext {
  /** Navigate via Next router */
  navigate: (href: string) => void;
  /** Show a toast */
  toast?: (args: {
    title: string;
    description?: string;
    variant?: "default" | "success" | "error" | "warning";
  }) => void;
}

export function buildCommands(ctx: CommandContext): Command[] {
  const nav = (href: string) => ({ close }: { close: () => void }) => {
    ctx.navigate(href);
    close();
  };

  return [
    // ── Navigation ──────────────────────────────────────────────────
    {
      id: "nav.cockpit",
      title: "Go to Cockpit",
      group: "Navigation",
      keywords: ["home", "dashboard", "overview"],
      run: nav("/leads"),
    },
    {
      id: "nav.pipeline",
      title: "Go to Pipeline",
      group: "Navigation",
      keywords: ["kanban", "deals", "funnel", "stages"],
      run: nav("/leads/pipeline"),
    },
    {
      id: "nav.people",
      title: "Go to People",
      group: "Navigation",
      keywords: ["contacts", "clients", "leads", "database"],
      run: nav("/leads/people"),
    },
    {
      id: "nav.marketing",
      title: "Go to Marketing",
      group: "Navigation",
      keywords: ["drips", "sequences", "email", "content"],
      run: nav("/leads/marketing"),
    },
    {
      id: "nav.admin",
      title: "Go to Admin",
      group: "Navigation",
      keywords: ["settings", "billing", "mls", "integrations"],
      run: nav("/leads/admin"),
    },

    // ── Smart lists ─────────────────────────────────────────────────
    {
      id: "list.hot",
      title: "Open hot leads (≥70 score)",
      group: "Smart Lists",
      keywords: ["hot", "high score", "urgent"],
      run: nav("/leads/people?list=hot"),
    },
    {
      id: "list.cold",
      title: "Open cold leads (>14d no touch)",
      group: "Smart Lists",
      keywords: ["cold", "stale", "forgotten"],
      run: nav("/leads/people?list=cold"),
    },
    {
      id: "list.buyers",
      title: "Open buyer clients",
      group: "Smart Lists",
      keywords: ["buyers", "looking", "prospects"],
      run: nav("/leads/people?list=buyers"),
    },
    {
      id: "list.sellers",
      title: "Open seller clients",
      group: "Smart Lists",
      keywords: ["sellers", "listings"],
      run: nav("/leads/people?list=sellers"),
    },
    {
      id: "list.matches",
      title: "Open buyer-listing matches",
      group: "Smart Lists",
      keywords: ["matches", "fit score"],
      run: nav("/leads/people?list=matches"),
    },

    // ── Actions ─────────────────────────────────────────────────────
    {
      id: "action.snap",
      title: "Snap & Know — drop a photo",
      group: "Actions",
      keywords: ["photo", "scan", "image", "picture"],
      run: nav("/leads/snap"),
    },
    {
      id: "action.dossier",
      title: "Build dossier from address",
      group: "Actions",
      keywords: ["research", "report", "background", "owner"],
      run: nav("/leads/dossier"),
    },
    {
      id: "action.cma",
      title: "Run CMA / comps analysis",
      group: "Actions",
      keywords: ["comps", "valuation", "cma", "pricing"],
      run: nav("/leads/comps"),
    },
    {
      id: "action.unclaimed",
      title: "Scan unclaimed funds",
      group: "Actions",
      keywords: ["money", "surplus", "treasury"],
      run: nav("/leads/unclaimed"),
    },
    {
      id: "action.import-rpr",
      title: "Import from NARRPR",
      group: "Actions",
      keywords: ["rpr", "narrpr", "import", "csv"],
      run: nav("/leads/narrpr"),
    },
    {
      id: "action.market-intel",
      title: "Open market intelligence",
      group: "Actions",
      keywords: ["fred", "rates", "mortgage", "economy"],
      run: nav("/leads/markets"),
    },

    // ── Marketing ──────────────────────────────────────────────────
    {
      id: "mk.sequences",
      title: "Open SMS sequences",
      group: "Marketing",
      keywords: ["drip", "twilio", "a2p", "text"],
      run: nav("/leads/marketing?tab=sequences"),
    },
    {
      id: "mk.email",
      title: "Open email sequences",
      group: "Marketing",
      keywords: ["email", "drip", "newsletter"],
      run: nav("/leads/marketing?tab=email"),
    },
    {
      id: "mk.scripts",
      title: "Open scripts library",
      group: "Marketing",
      keywords: ["talk track", "rehearse", "call script"],
      run: nav("/leads/marketing?tab=scripts"),
    },
    {
      id: "mk.content",
      title: "Open content studio",
      group: "Marketing",
      keywords: ["posts", "social", "youtube", "tiktok", "instagram"],
      run: nav("/leads/content"),
    },
    {
      id: "mk.farm-mail",
      title: "Open farm mail",
      group: "Marketing",
      keywords: ["direct mail", "postcards", "mailers"],
      run: nav("/leads/marketing?tab=farm-mail"),
    },
    {
      id: "mk.open-house",
      title: "Open house manager",
      group: "Marketing",
      keywords: ["open house", "sign-in", "qr"],
      run: nav("/leads/marketing?tab=open-house"),
    },

    // ── Admin ──────────────────────────────────────────────────────
    {
      id: "admin.billing",
      title: "Billing & plans",
      group: "Admin",
      keywords: ["stripe", "subscription", "pro", "team", "upgrade"],
      run: nav("/leads/admin?tab=billing"),
    },
    {
      id: "admin.integrations",
      title: "Integrations & MLS",
      group: "Admin",
      keywords: ["twilio", "mls grid", "connects"],
      run: nav("/leads/admin?tab=integrations"),
    },
    {
      id: "admin.settings",
      title: "Settings & farm area",
      group: "Admin",
      keywords: ["farm", "zips", "sms limit", "preferences"],
      run: nav("/leads/admin?tab=settings"),
    },
    {
      id: "admin.workflow",
      title: "Edit workflow / pipeline DAG",
      group: "Admin",
      keywords: ["automation", "flow", "dag", "plugins"],
      run: nav("/leads/admin?tab=workflow"),
    },
    {
      id: "admin.analytics",
      title: "Analytics & ROI",
      group: "Admin",
      keywords: ["analytics", "roi", "conversion", "funnel"],
      run: nav("/leads/admin?tab=analytics"),
    },

    // ── App ────────────────────────────────────────────────────────
    {
      id: "app.help",
      title: "Help & keyboard shortcuts",
      group: "App",
      keywords: ["help", "shortcuts", "keys"],
      shortcut: ["?"],
      run: nav("/leads/_dev/primitives"),
    },
  ];
}
