import { SUBSITES } from "@/lib/subsites";

/**
 * The consumer-facing service directory. This is the marketing/display layer
 * that /start and the "More from Tolley" cross-sell strip render from.
 *
 * It is NOT a second source of truth for what exists — `lib/subsites.ts` is.
 * `DIRECTORY_DISPLAY` only adds the marketing polish (group, tagline, image,
 * accent) that the machine-facing manifests lack, keyed by subsite `name`.
 * `buildDirectory()` joins this against the live registry so the directory can
 * never list a product that isn't registered, and warns (dev only) if a
 * consumer subsite is registered but missing here — so /start can't drift.
 */

export type DirectoryGroup =
  | "Real Estate"
  | "Rentals"
  | "Home Services"
  | "Hauling & Delivery"
  | "Shop & Food"
  | "AI & Ventures"
  | "Start a Business"
  | "Events";

export const DIRECTORY_GROUP_ORDER: DirectoryGroup[] = [
  "Start a Business",
  "Real Estate",
  "Home Services",
  "Rentals",
  "Hauling & Delivery",
  "Shop & Food",
  "AI & Ventures",
  "Events",
];

interface DisplayMeta {
  group: DirectoryGroup;
  tagline: string;
  bullets: string[];
  image?: string; // public/ path; omitted → emoji fallback
  emoji: string; // fallback + small accent
  accent: string; // tailwind color stem, e.g. "sky"
  /** Bump toward the front of cross-sell suggestions. */
  featured?: boolean;
}

// Keyed by subsite `name` (must match lib/subsites.ts). Legal/infra/misc
// subsites are intentionally absent — they are not consumer products.
const DIRECTORY_DISPLAY: Record<string, DisplayMeta> = {
  sales: {
    group: "Start a Business",
    tagline: "Start a business with no license, no bank, no money",
    bullets: ["Ready-to-run businesses", "I handle the back office", "Handshake deal"],
    image: "/sales/receipts/shop.jpg",
    emoji: "🚀",
    accent: "orange",
    featured: true,
  },
  advertising: {
    group: "Start a Business",
    tagline: "Advertise your business on the Tolley network",
    bullets: ["Sponsored placements", "Local KC reach", "Rate card"],
    emoji: "📣",
    accent: "amber",
  },
  homes: {
    group: "Real Estate",
    tagline: "Buy & sell homes with a licensed KC agent",
    bullets: ["Kansas City metro", "Licensed agent", "Full service"],
    image: "/homes/headshot.jpg",
    emoji: "🏡",
    accent: "sky",
    featured: true,
  },
  "real-estate-agent": {
    group: "Real Estate",
    tagline: "Free KC neighborhood intel + agent consult",
    bullets: ["Neighborhood data", "Market reports", "No obligation"],
    emoji: "📍",
    accent: "sky",
  },
  hvac: {
    group: "Home Services",
    tagline: "Heating & cooling, 24/7 — The Cool Guys KC",
    bullets: ["24/7 emergency", "Repair & install", "Independence, MO"],
    image: "/hvac/mascot.jpg",
    emoji: "❄️",
    accent: "cyan",
  },
  pools: {
    group: "Home Services",
    tagline: "Pool supplies at contractor pricing, delivered",
    bullets: ["Beat retail prices", "Same-day KC delivery", "No membership"],
    image: "/pools/stock-pools.jpg",
    emoji: "🏊",
    accent: "cyan",
    featured: true,
  },
  water: {
    group: "Home Services",
    tagline: "Free pool water testing & dosing dashboard",
    bullets: ["Balance your water", "Track readings", "Save on chemicals"],
    emoji: "💧",
    accent: "teal",
  },
  wd: {
    group: "Rentals",
    tagline: "Washer & dryer rental — delivered & installed",
    bullets: ["Monthly, no credit check", "Delivered & installed", "KC metro"],
    image: "/wd/stock-wd.jpg",
    emoji: "🧺",
    accent: "blue",
    featured: true,
  },
  trailer: {
    group: "Rentals",
    tagline: "Enclosed cargo trailer rental",
    bullets: ["16ft to 20ft", "Up to 10,000 lbs", "Utility & car haulers"],
    image: "/trailer/20/20-1.jpg",
    emoji: "🚚",
    accent: "amber",
  },
  generator: {
    group: "Rentals",
    tagline: "Honda generator rental for jobs & events",
    bullets: ["Portable power", "Delivery available", "Jobs & events"],
    image: "/generator/gen-1.jpg",
    emoji: "⚡",
    accent: "yellow",
  },
  kerplunk: {
    group: "Rentals",
    tagline: "Furniture rental — Kerplunk",
    bullets: ["Furnish fast", "Flexible terms", "KC metro"],
    image: "/kerplunk/kerplunk-1.jpg",
    emoji: "🛋️",
    accent: "violet",
  },
  "picnic-table": {
    group: "Rentals",
    tagline: "Picnic table rental for events",
    bullets: ["Events & parties", "Delivered", "By the day"],
    image: "/picnic-table/picnic-1.jpg",
    emoji: "🧺",
    accent: "green",
  },
  tables: {
    group: "Rentals",
    tagline: "Table & chair rental",
    bullets: ["Events & gatherings", "Delivered & set up", "KC metro"],
    image: "/tables/tables-10.jpg",
    emoji: "🪑",
    accent: "stone",
  },
  moving: {
    group: "Rentals",
    tagline: "Reusable moving-supply bundles",
    bullets: ["Skip the cardboard", "Reusable bins", "Packing kits"],
    image: "/moving/mv-1.jpg",
    emoji: "📦",
    accent: "emerald",
  },
  junkinjays: {
    group: "Hauling & Delivery",
    tagline: "Same-day junk removal — Junk in Jay's",
    bullets: ["Scrap & junk hauling", "Batteries & copper", "Same-day"],
    image: "/junkinjays/stock-junk.jpg",
    emoji: "🗑️",
    accent: "orange",
  },
  moupins: {
    group: "Hauling & Delivery",
    tagline: "Junk removal & moving — Precision Transfer",
    bullets: ["Junk removal", "Moving help", "Same-day quotes"],
    image: "/moupins/stock-moupins.jpg",
    emoji: "🚛",
    accent: "green",
  },
  lastmile: {
    group: "Hauling & Delivery",
    tagline: "Last-mile delivery for contractors & B2B",
    bullets: ["3,000+ deliveries", "From $2/mile", "Trailers to 10,000 lbs"],
    image: "/lastmile/jared-pallet.jpg",
    emoji: "📦",
    accent: "red",
    featured: true,
  },
  drive: {
    group: "Hauling & Delivery",
    tagline: "On-demand delivery — Red Alert Dispatch",
    bullets: ["Same-day", "KC metro", "Request a run"],
    emoji: "🚗",
    accent: "red",
  },
  shop: {
    group: "Shop & Food",
    tagline: "Furniture & home goods — Treasure Haul",
    bullets: ["New items daily", "Message to buy", "Local pickup"],
    image: "/shop/stock-shop.jpg",
    emoji: "🛍️",
    accent: "pink",
    featured: true,
  },
  food: {
    group: "Shop & Food",
    tagline: "Ruthann's Kitchen — recipes & meal plans",
    bullets: ["$39/yr", "Weekly meal plans", "Grocery lists"],
    image: "/sales/receipts/food.jpg",
    emoji: "🍳",
    accent: "rose",
  },
  video: {
    group: "AI & Ventures",
    tagline: "AI video generation on NVIDIA Blackwell",
    bullets: ["Text-to-video", "Cinematic quality", "Pay per video"],
    image: "/video/stock-video.jpg",
    emoji: "🎬",
    accent: "purple",
  },
  vater: {
    group: "AI & Ventures",
    tagline: "Vater Ventures — the content factory",
    bullets: ["YouTube & shorts", "Merch & courses", "All local"],
    image: "/vater/stock-vater.jpg",
    emoji: "🏭",
    accent: "indigo",
  },
  scan: {
    group: "AI & Ventures",
    tagline: "Scan & Know — photo to full dossier",
    bullets: ["Snap a photo", "Instant intel", "AI dossier"],
    emoji: "🔎",
    accent: "slate",
  },
  leads: {
    group: "AI & Ventures",
    tagline: "T-Agent — the real-estate lead pipeline",
    bullets: ["Motivated sellers", "AI enrichment", "For agents"],
    emoji: "🎯",
    accent: "sky",
  },
  agents: {
    group: "AI & Ventures",
    tagline: "Build your own AI agents",
    bullets: ["No-code agents", "Automate work", "Tolley-hosted"],
    emoji: "🤖",
    accent: "violet",
  },
  "e-and-t": {
    group: "Events",
    tagline: "13:13 Weddings & Events",
    bullets: ["Lee's Summit planner", "Full-service", "Book a consult"],
    emoji: "💍",
    accent: "rose",
  },
  cleanouts: {
    group: "Hauling & Delivery",
    tagline: "Estate & rental cleanouts, junk removal — free quotes",
    bullets: ["KC metro", "Fast haul-away", "Call or text a photo"],
    emoji: "🗑️",
    accent: "amber",
  },
  estate: {
    group: "Home Services",
    tagline: "Full-service estate sales — free walkthrough, fast settlement",
    bullets: [
      "Next sale: Jul 17–18, Independence",
      "We stage, price & advertise",
      "Nothing goes to waste",
    ],
    emoji: "🏛️",
    accent: "amber",
    featured: true,
  },
  crazybins: {
    group: "Shop & Food",
    tagline: "Liquidation bin store — 60–80% off retail",
    bullets: ["Independence, MO", "New bins weekly", "Daily price ladder"],
    emoji: "🛒",
    accent: "red",
  },
  animate: {
    group: "AI & Ventures",
    tagline: "Type a topic, publish a video — ~$25, no subscription",
    bullets: ["AI video studio", "Pay per video", "Auto-billed via Stripe"],
    emoji: "🎬",
    accent: "violet",
  },
};

export interface DirectoryEntry extends DisplayMeta {
  name: string;
  url: string;
  title: string;
}

/**
 * Join the display map against the live registry. Only registered subsites are
 * returned; a dev warning fires for consumer subsites missing a display entry.
 */
export function buildDirectory(): DirectoryEntry[] {
  const byName = new Map(SUBSITES.map((s) => [s.name, s]));
  const entries: DirectoryEntry[] = [];

  for (const [name, meta] of Object.entries(DIRECTORY_DISPLAY)) {
    const sub = byName.get(name);
    if (!sub) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[directory] "${name}" has display metadata but is not in lib/subsites.ts`);
      }
      continue;
    }
    entries.push({ ...meta, name, url: sub.url, title: sub.title });
  }

  if (process.env.NODE_ENV !== "production") {
    // Flag consumer subsites (marketing, or public products with a landing) that
    // have no display entry — the drift guard.
    const INFRA = new Set([
      "about", "billing", "crypto", "data-retention", "gpu", "pricing", "privacy",
      "results", "security", "signup", "terms", "start", "circle", "blog", "markets",
      "rental", "rentals", "go", "pay", "tools", "client", "client-portal",
    ]);
    for (const s of SUBSITES) {
      if (INFRA.has(s.name)) continue;
      if (s.category === "misc") continue;
      if (!DIRECTORY_DISPLAY[s.name]) {
        console.warn(`[directory] consumer subsite "${s.name}" (${s.url}) has no display entry in lib/directory.ts`);
      }
    }
  }

  return entries;
}

/** Directory grouped + ordered for the /start page. */
export function directoryByGroup(): { group: DirectoryGroup; entries: DirectoryEntry[] }[] {
  const all = buildDirectory();
  return DIRECTORY_GROUP_ORDER.map((group) => ({
    group,
    entries: all.filter((e) => e.group === group),
  })).filter((g) => g.entries.length > 0);
}

/**
 * Cross-sell picks for the "More from Tolley" strip. Prefers siblings in the
 * same group, fills the rest with featured entries, always excludes `self`.
 */
export function crossSell(selfName: string, count = 4): DirectoryEntry[] {
  const all = buildDirectory().filter((e) => e.name !== selfName);
  const self = DIRECTORY_DISPLAY[selfName];
  const siblings = self ? all.filter((e) => e.group === self.group) : [];
  const featured = all.filter((e) => e.featured && e.group !== self?.group);
  const rest = all.filter((e) => !siblings.includes(e) && !featured.includes(e));
  const ordered = [...siblings, ...featured, ...rest];
  // De-dup while preserving order, then take `count`.
  const seen = new Set<string>();
  const out: DirectoryEntry[] = [];
  for (const e of ordered) {
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    out.push(e);
    if (out.length >= count) break;
  }
  return out;
}
