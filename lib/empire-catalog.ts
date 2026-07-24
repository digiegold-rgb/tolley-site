// ── Empire Map catalog — the static picture of the whole operation ──────────
// Nodes/edges/lanes for the /hq Empire tab. Health is merged in at read time
// by lib/empire-map.ts; this file is pure data with zero imports so both the
// server payload builder and the client canvas can use it.
//
// Signal grammar (parsed by lib/empire-map.ts):
//   "dgx:unit:<name>"     systemd user service — last run + Result       (needs cadenceMin)
//   "dgx:timer:<name>"    like unit, but also RED when the timer has no next run scheduled
//   "dgx:port:<key>"      local port probe from the collector — up = "running" (blue)
//   "dgx:docker:<name>"   docker .State.Status — running = "running"
//   "dgx:file:<key>"      state-file mtime                                (needs cadenceMin)
//   "dgx:fleet:<key>"     field from ~/.cache/fleet-status.json
//   "dgx:conn:<key>"      external connection calibration (publish tokens, login
//                         sessions, API keys) — probed every collector run by
//                         connections.mjs; broken conns auto-queue to Must Complete
//   "dgx:backup"          parsed /var/log/dgx-backup.log verdict (local NAS tier)
//   "dgx:backup-offsite"  GCS offsite tier verdict from the same log
//   "dgx:self"            freshness of the DGX snapshot itself (the canary node)
//   "cron:<path>"         site-side Vercel cron heartbeat (lib/cron-config.ts CRONS)
//   "cron:rollup"         aggregate of ALL site crons — amber if any unhealthy, red if >3
//   "db:<key>"            named Prisma query in lib/empire-map.ts DB_SIGNALS (needs cadenceMin)
//   "manual:paused" | "manual:killed" | "manual:missing" | "manual:broken:<reason>"
//
// Retiring something? Flip its signal to "manual:killed" — don't delete the
// node. The map should show the graveyard honestly.
// Adding a dgx:* signal? Add the unit/port/file to the collector's lists in
// ~/dgx-services/empire-collector/collect.mjs too.

export type EmpireLaneId =
  | "jared-biz"
  | "jared-content"
  | "jared-funnel"
  | "ruthann"
  | "clients"
  | "infra";

export type EmpireNodeKind = "business" | "pipeline" | "page" | "channel" | "service" | "infra";

export type EmpireStatus =
  | "working" // scheduled job ran recently (≤1.5× cadence) — green pulse
  | "running" // long-running service is up — steady blue
  | "stale" // ran, but too long ago (≤4× cadence) — amber
  | "broken" // failed / down / >4× cadence / timer unscheduled — red breathe
  | "missing" // not built yet — gray
  | "paused" // deliberately paused — gray ⏸
  | "killed"; // deliberately shut down — gray ✕

export interface EmpireNodeDef {
  id: string;
  label: string;
  lane: EmpireLaneId;
  row: number; // grid row within the lane band
  col: number; // grid column within the lane band
  kind: EmpireNodeKind;
  icon: string; // emoji
  signal: string;
  cadenceMin?: number; // expected run cadence — drives working/stale/broken bucketing
  href?: string; // drawer "Open →" link
  note?: string; // static context line shown in the drawer
}

export interface EmpireEdgeDef {
  id: string;
  source: string;
  target: string;
  kind: "flow" | "data" | "money"; // flow=teal, data=blue, money=green
}

export interface EmpireLane {
  id: EmpireLaneId;
  label: string;
  owner: "Jared" | "Ruthann" | "Clients" | "Infra";
  accent: string; // css color for the lane's left border + node accent bar
}

const day = 1440;
const week = 7 * day;

export const EMPIRE_LANES: EmpireLane[] = [
  { id: "jared-biz", label: "JARED — BUSINESSES", owner: "Jared", accent: "#2dd4a7" },
  { id: "jared-content", label: "JARED — CONTENT & DISTRIBUTION", owner: "Jared", accent: "#38bdf8" },
  { id: "jared-funnel", label: "JARED — FUNNEL", owner: "Jared", accent: "#a78bfa" },
  { id: "ruthann", label: "RUTHANN", owner: "Ruthann", accent: "#fb7185" },
  { id: "clients", label: "OUTSIDE CLIENTS", owner: "Clients", accent: "#fbbf24" },
  { id: "infra", label: "INFRA — DGX / NETWORK / BACKUPS", owner: "Infra", accent: "#64748b" },
];

export const EMPIRE_NODES: EmpireNodeDef[] = [
  // ── JARED — BUSINESSES ────────────────────────────────────────────────────
  { id: "biz-estate", label: "Tolley Estate Sales", lane: "jared-biz", row: 0, col: 0, kind: "business", icon: "🏷️", signal: "db:estate", cadenceMin: 3 * day, href: "/estate", note: "#1 focus. Sale #1: $5k+ gross / 2 days @ 35%." },
  { id: "biz-wd", label: "W/D Rentals", lane: "jared-biz", row: 0, col: 1, kind: "business", icon: "🌀", signal: "db:wd", cadenceMin: 2 * day, href: "/wd/admin", note: "Real MRR $1,476 · 26 subs (7/8 reconcile)." },
  { id: "biz-tagent", label: "T-Agent / Tolley SaaS", lane: "jared-biz", row: 0, col: 2, kind: "business", icon: "🤖", signal: "manual:paused", href: "/", note: "Parked until paying clients (priority list). Flip signal back to db:tagent when revived." },
  { id: "biz-realestate", label: "Real Estate (MLS)", lane: "jared-biz", row: 0, col: 3, kind: "business", icon: "🏠", signal: "cron:/api/cron/mls-sync", href: "/homes", note: "MLS Grid = DEMO feed, frozen ~6/2." },
  { id: "biz-delivery", label: "1099 Delivery", lane: "jared-biz", row: 0, col: 4, kind: "business", icon: "📦", signal: "cron:/api/cron/dispatch-match", href: "/drive" },
  { id: "biz-shop", label: "Shop / Reselling", lane: "jared-biz", row: 0, col: 5, kind: "business", icon: "🛒", signal: "cron:/api/cron/shop-intelligence", href: "/shop" },
  { id: "biz-trading", label: "Trading Engine", lane: "jared-biz", row: 1, col: 0, kind: "business", icon: "📈", signal: "dgx:unit:trading-sync", cadenceMin: 10, href: "/trading" },
  { id: "biz-pools", label: "Pools", lane: "jared-biz", row: 1, col: 1, kind: "business", icon: "🏊", signal: "dgx:unit:pool360-sync", cadenceMin: day, href: "/pools" },
  { id: "biz-passive", label: "Seller Digest $199/mo", lane: "jared-biz", row: 1, col: 2, kind: "business", icon: "💌", signal: "db:passive", cadenceMin: 2 * week, href: "/leads" },
  { id: "biz-launchpad", label: "Launchpad V2", lane: "jared-biz", row: 1, col: 3, kind: "business", icon: "🚀", signal: "db:views:launchpad", cadenceMin: week, href: "/start", note: "SerpAPI quota exhausted." },
  { id: "biz-animate", label: "Animate Studio", lane: "jared-biz", row: 1, col: 4, kind: "business", icon: "🎨", signal: "db:views:animate", cadenceMin: 2 * week, href: "/animate", note: "$25 pay-per-video, Stripe auto-invoice." },
  { id: "conn-wd-pace", label: "W&D FB Pace", lane: "jared-biz", row: 2, col: 1, kind: "service", icon: "📈", signal: "dgx:conn:fb-wd-pace", note: "Published posts last 7d vs 30/wk — fb-daily-post generator, 7 days (4/day + Fri/Sat party post) = 30." },
  { id: "conn-kchomes-pace", label: "KC Homes FB Pace", lane: "jared-biz", row: 2, col: 3, kind: "service", icon: "📈", signal: "dgx:conn:fb-kchomes-pace", note: "Published posts last 7d vs 30/wk — BAY statcard + daily-post + listings video leg." },

  // ── JARED — CONTENT & DISTRIBUTION ───────────────────────────────────────
  { id: "pipe-shorts", label: "Product Shorts (Wan)", lane: "jared-content", row: 0, col: 0, kind: "pipeline", icon: "🎬", signal: "dgx:timer:growth-shorts", cadenceMin: day, note: "Cheap Modal/Wan 2x-motion recipe · ~$1.40/video · 2/day 10:00 → YT + Treasure Haul FB." },
  { id: "pipe-lipsync", label: "Shorts Lip-sync v4", lane: "jared-content", row: 1, col: 0, kind: "pipeline", icon: "👄", signal: "manual:paused", note: "Built + gated; timer paused until billing test." },
  { id: "pipe-kchousing", label: "KC Housing Daily", lane: "jared-content", row: 0, col: 1, kind: "pipeline", icon: "🏘️", signal: "dgx:unit:housing-hub", cadenceMin: day, href: "/housing" },
  { id: "pipe-newhomes", label: "New KC Homes Today", lane: "jared-content", row: 1, col: 1, kind: "pipeline", icon: "🆕", signal: "dgx:unit:listings-video", cadenceMin: day, note: "Faceless long-form YT, daily 10:30." },
  { id: "pipe-actioncam", label: "Action Cam v2", lane: "jared-content", row: 0, col: 2, kind: "pipeline", icon: "📹", signal: "dgx:unit:action-daily", cadenceMin: day, note: "DJI → NAS → AI reels → Plex → social." },
  { id: "pipe-social", label: "Social Suite", lane: "jared-content", row: 1, col: 2, kind: "pipeline", icon: "📱", signal: "cron:/api/cron/content-publish", href: "/social" },
  { id: "pipe-vater", label: "Vater / YT Factory", lane: "jared-content", row: 0, col: 3, kind: "pipeline", icon: "🎥", signal: "cron:/api/cron/vater-rss-poll", cadenceMin: 2 * day, href: "/vater", note: "RSS heartbeat only ticks on new items — judged on a 2-day window, not the 15-min poll." },
  { id: "pipe-trend", label: "Trend Arbitrage", lane: "jared-content", row: 1, col: 3, kind: "pipeline", icon: "📉", signal: "manual:killed", note: "Killed 7/23 — underperformed. Code intact." },
  { id: "pipe-pinterest", label: "Pinterest", lane: "jared-content", row: 1, col: 4, kind: "pipeline", icon: "📌", signal: "dgx:unit:pinterest-service", cadenceMin: day, href: "https://www.pinterest.com/jaredtolley/", note: "Self-healing since 7/23: auto re-login with stored creds. :9107 Selenium, verified publishes." },
  { id: "pipe-backatyou", label: "Back At You → LI", lane: "jared-content", row: 1, col: 5, kind: "pipeline", icon: "💼", signal: "dgx:file:backatyou", cadenceMin: 2 * day, note: "Only LinkedIn pipe — posts the stat card." },
  { id: "chan-youtube", label: "YouTube", lane: "jared-content", row: 0, col: 4, kind: "channel", icon: "▶️", signal: "db:youtube", cadenceMin: day, note: "@yourkchome · stats cron 11:30 UTC." },
  { id: "chan-facebook", label: "Facebook Pages", lane: "jared-content", row: 0, col: 5, kind: "channel", icon: "📘", signal: "cron:/api/cron/fb-sync" },
  { id: "chan-instagram", label: "Instagram", lane: "jared-content", row: 0, col: 6, kind: "channel", icon: "📸", signal: "dgx:conn:ig-publish", note: "Live token probe — Blob fix ready once re-authed." },
  { id: "chan-tiktok", label: "TikTok", lane: "jared-content", row: 1, col: 6, kind: "channel", icon: "🎵", signal: "manual:broken:posts stuck \"Only me\" until review clears" },
  { id: "conn-yt-upload", label: "YT Upload Token", lane: "jared-content", row: 2, col: 4, kind: "service", icon: "🔑", signal: "dgx:conn:yt-upload", note: "OAuth refresh + channels.list, calibrated nightly." },
  { id: "conn-pinterest", label: "Pinterest Session", lane: "jared-content", row: 2, col: 5, kind: "service", icon: "🔑", signal: "dgx:conn:pinterest-session", note: "logged_in state of :9107 Selenium session." },
  { id: "pipe-pinfeatured", label: "Featured-Home Pins", lane: "jared-content", row: 2, col: 6, kind: "pipeline", icon: "📌", signal: "dgx:timer:pin-featured", cadenceMin: 720, href: "https://www.pinterest.com/jaredtolley/", note: "2x daily (15:30 + 19:30): re-pins FB-featured homes, 3/run, fresh angles + captions → tolley.io/housing." },
  { id: "conn-pin-pace", label: "Pin Pace", lane: "jared-content", row: 2, col: 3, kind: "service", icon: "📈", signal: "dgx:conn:pinterest-pace", href: "https://www.pinterest.com/jaredtolley/", note: "Verified pins last 7d from the :9107 publish ledger vs ~90/wk target (statcard + listings + featured + products + socialite). Red = machine stalled → auto-queues to Must Complete." },

  // ── JARED — FUNNEL ───────────────────────────────────────────────────────
  { id: "fun-site", label: "tolley.io", lane: "jared-funnel", row: 0, col: 0, kind: "page", icon: "🌐", signal: "db:views:any", cadenceMin: 720, href: "/" },
  { id: "fun-circle", label: "The Circle", lane: "jared-funnel", row: 0, col: 1, kind: "page", icon: "⭕", signal: "db:circle", cadenceMin: day, href: "/circle", note: "The flywheel. Watch leads-by-ref here." },
  { id: "fun-start", label: "/start Registry", lane: "jared-funnel", row: 1, col: 1, kind: "page", icon: "🧭", signal: "db:views:start", cadenceMin: 2 * day, href: "/start" },
  { id: "fun-inbox", label: "/hq Inbox", lane: "jared-funnel", row: 0, col: 2, kind: "page", icon: "📥", signal: "db:inbox", cadenceMin: 3 * day, href: "/hq?tab=inbound" },
  { id: "fun-outbound", label: "Instantly Outbound", lane: "jared-funnel", row: 0, col: 3, kind: "pipeline", icon: "⚡", signal: "db:touches", cadenceMin: week, note: "Site + delivery + estate campaigns. Jared pulls the trigger." },
  { id: "fun-replies", label: "Reply Webhook", lane: "jared-funnel", row: 0, col: 4, kind: "service", icon: "💬", signal: "dgx:unit:growth-replies", cadenceMin: 120, note: "Instantly → tolley.io → GrowthTouch + DNC detection." },
  { id: "fun-telegram", label: "Telegram Pings", lane: "jared-funnel", row: 0, col: 5, kind: "channel", icon: "✈️", signal: "dgx:unit:daily-receipt", cadenceMin: day, note: "Daily receipt 07:00 + lead/reply pings." },
  { id: "conn-instantly", label: "Instantly API", lane: "jared-funnel", row: 1, col: 3, kind: "service", icon: "🔑", signal: "dgx:conn:instantly-api" },
  { id: "conn-telegram", label: "TG Bot Token", lane: "jared-funnel", row: 1, col: 5, kind: "service", icon: "🔑", signal: "dgx:conn:telegram-bot" },
  { id: "fun-fbautoreply", label: "FB Auto-Reply", lane: "jared-funnel", row: 1, col: 4, kind: "service", icon: "🤖", signal: "dgx:timer:fb-auto-reply", cadenceMin: 10, note: "Messenger FAQ bot — polls all pages every 2 min, answers pricing/delivery/phone, Telegram-pings every reply." },

  // ── RUTHANN ──────────────────────────────────────────────────────────────
  { id: "ruth-kitchen", label: "Ruthann's Kitchen", lane: "ruthann", row: 0, col: 0, kind: "business", icon: "🍲", signal: "cron:/api/cron/food-trial-ending", href: "/food", note: "$39/yr." },
  { id: "ruth-treasure", label: "Treasure Haul (FB)", lane: "ruthann", row: 0, col: 1, kind: "channel", icon: "💎", signal: "cron:/api/cron/treasure-haul-daily", note: "FB page ↔ /shop mirror." },
  { id: "ruth-shop", label: "/shop Mirror", lane: "ruthann", row: 0, col: 2, kind: "page", icon: "🏪", signal: "db:views:shop", cadenceMin: 2 * day, href: "/shop" },
  { id: "ruth-fbclean", label: "FB Cleanup Bot", lane: "ruthann", row: 0, col: 3, kind: "pipeline", icon: "🧹", signal: "dgx:unit:ruthann-fb-cleanup", cadenceMin: week },
  { id: "conn-fb-treasure", label: "FB Publish Token", lane: "ruthann", row: 1, col: 1, kind: "service", icon: "🔑", signal: "dgx:conn:fb-treasure-publish", note: "Deep probe: starts (and abandons) a real reel upload — catches identity checkpoints a /me check misses." },
  { id: "conn-th-pace", label: "TH Post Pace", lane: "ruthann", row: 1, col: 2, kind: "service", icon: "📈", signal: "dgx:conn:fb-treasure-pace", note: "Published posts last 7d vs the 30/week target — red only if the machine stalls (<7)." },
  { id: "ruth-treasurepins", label: "Treasure Pins", lane: "ruthann", row: 1, col: 3, kind: "pipeline", icon: "💎", signal: "dgx:timer:treasure-pins", cadenceMin: 720, href: "https://www.pinterest.com/jaredtolley/", note: "2x daily (12:30 + 17:30): listed /shop finds → 'Treasure Haul Finds' Pinterest board, product-page links, 45d rotation." },

  // ── OUTSIDE CLIENTS ──────────────────────────────────────────────────────
  { id: "cli-crazybins", label: "Crazy Bin Store #2", lane: "clients", row: 0, col: 0, kind: "page", icon: "🗑️", signal: "db:views:crazybins", cadenceMin: week, href: "/crazybins" },
  { id: "cli-weddings", label: "13:13 Weddings", lane: "clients", row: 0, col: 1, kind: "page", icon: "💒", signal: "db:views:e-and-t", cadenceMin: 2 * week, href: "/e-and-t" },
  { id: "cli-olsson", label: "Olsson BPO (Ed M.)", lane: "clients", row: 0, col: 2, kind: "business", icon: "🏗️", signal: "manual:missing", note: "BPO drafted 5/19 — verify in Matrix before send." },
  { id: "cli-buckeye-extract", label: "Buckeye Extract", lane: "clients", row: 0, col: 3, kind: "pipeline", icon: "🧾", signal: "dgx:unit:buckeye-extract", cadenceMin: 120, note: "Slips → Gemini OCR, hourly." },
  { id: "cli-buckeye-build", label: "Buckeye Invoice", lane: "clients", row: 0, col: 4, kind: "pipeline", icon: "🔨", signal: "dgx:unit:buckeye-build", cadenceMin: 2 * day, note: "Weekly draft Sun 20:00 → AP Alicia Borden." },
  { id: "cli-buckeye-recon", label: "Buckeye Reconcile", lane: "clients", row: 0, col: 5, kind: "pipeline", icon: "⚖️", signal: "dgx:unit:buckeye-reconcile", cadenceMin: week + day, note: "Bluevine deposits, Saturdays." },
  { id: "cli-stripe-recon", label: "Stripe Reconcile", lane: "clients", row: 0, col: 6, kind: "pipeline", icon: "💳", signal: "dgx:unit:stripe-invoice-reconcile", cadenceMin: day, note: "Daily 08:00 · INV-0144 $51 credit next." },

  // ── INFRA ────────────────────────────────────────────────────────────────
  { id: "inf-dgx", label: "DGX Spark", lane: "infra", row: 0, col: 0, kind: "infra", icon: "🖥️", signal: "dgx:self", cadenceMin: 900, note: "GB10 Blackwell 128GB — pushes this map 2×/day." },
  { id: "inf-vllm", label: "vLLM Qwen3.6 :8356", lane: "infra", row: 0, col: 1, kind: "service", icon: "🧠", signal: "dgx:port:vllm" },
  { id: "inf-litellm", label: "LiteLLM :4000", lane: "infra", row: 1, col: 1, kind: "service", icon: "🔀", signal: "dgx:port:litellm" },
  { id: "inf-openclaw", label: "OpenClaw (25 agents)", lane: "infra", row: 0, col: 2, kind: "service", icon: "🦞", signal: "dgx:port:openclaw" },
  { id: "inf-qdrant", label: "Qdrant RAG :6333", lane: "infra", row: 1, col: 2, kind: "service", icon: "🗃️", signal: "dgx:port:qdrant" },
  { id: "inf-comfy", label: "ComfyUI :8188", lane: "infra", row: 0, col: 3, kind: "service", icon: "🎛️", signal: "dgx:port:comfyui" },
  { id: "inf-research", label: "Research Worker :8900", lane: "infra", row: 1, col: 3, kind: "service", icon: "🔬", signal: "dgx:port:research", note: "17 scrapers." },
  { id: "inf-market", label: "Market Intel :8901", lane: "infra", row: 1, col: 0, kind: "service", icon: "📊", signal: "dgx:port:market-intel" },
  { id: "inf-backup", label: "NAS Backup", lane: "infra", row: 0, col: 4, kind: "infra", icon: "💾", signal: "dgx:backup", cadenceMin: day, note: "Nightly 03:00 → UGREEN, 7-day link-dest." },
  { id: "inf-offsite", label: "GCS Offsite", lane: "infra", row: 1, col: 4, kind: "infra", icon: "☁️", signal: "dgx:backup-offsite", cadenceMin: day, note: "Coldline gcs-crypt tier of the nightly backup." },
  { id: "inf-plex", label: "Plex / GEEKOM", lane: "infra", row: 0, col: 5, kind: "service", icon: "🎞️", signal: "dgx:fleet:plex" },
  { id: "inf-selfheal", label: "Fleet Selfheal", lane: "infra", row: 1, col: 5, kind: "service", icon: "🩹", signal: "dgx:unit:fleet-selfheal", cadenceMin: 30 },
  { id: "inf-xero", label: "Xero Ledger + Plaid", lane: "infra", row: 0, col: 6, kind: "service", icon: "📒", signal: "cron:/api/cron/budget-plaid-sync", note: ":8920 on DGX + Vercel budget crons." },
  { id: "inf-vercel", label: "Vercel Crons", lane: "infra", row: 1, col: 6, kind: "infra", icon: "▲", signal: "cron:rollup", note: "All tolley.io scheduled jobs, rolled up." },
  { id: "conn-site", label: "tolley.io Reach", lane: "infra", row: 2, col: 0, kind: "service", icon: "🔑", signal: "dgx:conn:tolley-site", note: "Reachability probed FROM the DGX." },
  { id: "conn-elevenlabs", label: "ElevenLabs API", lane: "infra", row: 2, col: 1, kind: "service", icon: "🔑", signal: "dgx:conn:elevenlabs-api" },
  { id: "conn-gemini", label: "Gemini API", lane: "infra", row: 2, col: 3, kind: "service", icon: "🔑", signal: "dgx:conn:gemini-api" },
  { id: "conn-stripe", label: "Stripe API", lane: "infra", row: 2, col: 6, kind: "service", icon: "🔑", signal: "dgx:conn:stripe-api" },
];

export const EMPIRE_EDGES: EmpireEdgeDef[] = [
  // Render chain / AI infra feeding content
  { id: "e-comfy-shorts", source: "inf-comfy", target: "pipe-shorts", kind: "data" },
  { id: "e-vllm-litellm", source: "inf-vllm", target: "inf-litellm", kind: "data" },
  { id: "e-litellm-openclaw", source: "inf-litellm", target: "inf-openclaw", kind: "data" },
  { id: "e-qdrant-openclaw", source: "inf-qdrant", target: "inf-openclaw", kind: "data" },
  { id: "e-openclaw-telegram", source: "inf-openclaw", target: "fun-telegram", kind: "flow" },

  // Content → channels
  { id: "e-shorts-yt", source: "pipe-shorts", target: "chan-youtube", kind: "flow" },
  { id: "e-kchousing-yt", source: "pipe-kchousing", target: "chan-youtube", kind: "flow" },
  { id: "e-newhomes-yt", source: "pipe-newhomes", target: "chan-youtube", kind: "flow" },
  { id: "e-vater-yt", source: "pipe-vater", target: "chan-youtube", kind: "flow" },
  { id: "e-trend-yt", source: "pipe-trend", target: "chan-youtube", kind: "flow" },
  { id: "e-actioncam-fb", source: "pipe-actioncam", target: "chan-facebook", kind: "flow" },
  { id: "e-social-ig", source: "pipe-social", target: "chan-instagram", kind: "flow" },
  { id: "e-social-tiktok", source: "pipe-social", target: "chan-tiktok", kind: "flow" },
  { id: "e-backatyou-fb", source: "pipe-backatyou", target: "chan-facebook", kind: "flow" },
  { id: "e-pinterest-site", source: "pipe-pinterest", target: "fun-site", kind: "flow" },
  { id: "e-newhomes-pinfeatured", source: "pipe-newhomes", target: "pipe-pinfeatured", kind: "data" },
  { id: "e-pinfeatured-site", source: "pipe-pinfeatured", target: "fun-site", kind: "flow" },
  { id: "e-treasure-fb", source: "ruth-treasure", target: "chan-facebook", kind: "flow" },
  { id: "e-shorts-treasure", source: "pipe-shorts", target: "ruth-treasure", kind: "flow" },

  // Connection calibration → what each unblocks (nightly deep probes)
  { id: "e-connfb-treasure", source: "conn-fb-treasure", target: "ruth-treasure", kind: "data" },
  { id: "e-connyt-yt", source: "conn-yt-upload", target: "chan-youtube", kind: "data" },
  { id: "e-connpin-pinterest", source: "conn-pinterest", target: "pipe-pinterest", kind: "data" },
  { id: "e-conninstantly-outbound", source: "conn-instantly", target: "fun-outbound", kind: "data" },
  { id: "e-conntg-telegram", source: "conn-telegram", target: "fun-telegram", kind: "data" },
  { id: "e-connstripe-xero", source: "conn-stripe", target: "inf-xero", kind: "data" },
  { id: "e-conngemini-shorts", source: "conn-gemini", target: "pipe-shorts", kind: "data" },
  { id: "e-connel-shorts", source: "conn-elevenlabs", target: "pipe-shorts", kind: "data" },
  { id: "e-wdpace-wd", source: "conn-wd-pace", target: "biz-wd", kind: "data" },
  { id: "e-kchomespace-re", source: "conn-kchomes-pace", target: "biz-realestate", kind: "data" },

  // Businesses feeding pipelines
  { id: "e-re-kchousing", source: "biz-realestate", target: "pipe-kchousing", kind: "data" },
  { id: "e-re-newhomes", source: "biz-realestate", target: "pipe-newhomes", kind: "data" },
  { id: "e-shop-treasure", source: "biz-shop", target: "ruth-shop", kind: "data" },
  { id: "e-shop-treasurepins", source: "ruth-shop", target: "ruth-treasurepins", kind: "data" },
  { id: "e-treasurepins-site", source: "ruth-treasurepins", target: "fun-site", kind: "flow" },

  // Channels → funnel (the marquee chain)
  { id: "e-yt-circle", source: "chan-youtube", target: "fun-circle", kind: "flow" },
  { id: "e-fb-circle", source: "chan-facebook", target: "fun-circle", kind: "flow" },
  { id: "e-circle-start", source: "fun-circle", target: "fun-start", kind: "flow" },
  { id: "e-start-inbox", source: "fun-start", target: "fun-inbox", kind: "flow" },
  { id: "e-site-inbox", source: "fun-site", target: "fun-inbox", kind: "flow" },
  { id: "e-inbox-outbound", source: "fun-inbox", target: "fun-outbound", kind: "flow" },
  { id: "e-outbound-replies", source: "fun-outbound", target: "fun-replies", kind: "flow" },
  { id: "e-replies-inbox", source: "fun-replies", target: "fun-inbox", kind: "flow" },
  { id: "e-replies-telegram", source: "fun-replies", target: "fun-telegram", kind: "flow" },

  // Funnel → businesses
  { id: "e-inbox-estate", source: "fun-inbox", target: "biz-estate", kind: "flow" },
  { id: "e-inbox-delivery", source: "fun-inbox", target: "biz-delivery", kind: "flow" },

  // Money → ledger
  { id: "e-wd-xero", source: "biz-wd", target: "inf-xero", kind: "money" },
  { id: "e-estate-xero", source: "biz-estate", target: "inf-xero", kind: "money" },
  { id: "e-kitchen-xero", source: "ruth-kitchen", target: "inf-xero", kind: "money" },
  { id: "e-striperecon-xero", source: "cli-stripe-recon", target: "inf-xero", kind: "money" },

  // Client pipeline chain
  { id: "e-bex-bbuild", source: "cli-buckeye-extract", target: "cli-buckeye-build", kind: "flow" },
  { id: "e-bbuild-brecon", source: "cli-buckeye-build", target: "cli-buckeye-recon", kind: "flow" },
  { id: "e-brecon-striperecon", source: "cli-buckeye-recon", target: "cli-stripe-recon", kind: "data" },

  // Infra chain
  { id: "e-dgx-backup", source: "inf-dgx", target: "inf-backup", kind: "data" },
  { id: "e-backup-offsite", source: "inf-backup", target: "inf-offsite", kind: "data" },
  { id: "e-selfheal-vllm", source: "inf-selfheal", target: "inf-vllm", kind: "data" },
];
