# Tolley.io Next.js App — Complete Route Map

**Generated:** 2026-03-31
**Location:** `/home/jelly/tolley-site`
**Framework:** Next.js (app router) + NextAuth + Prisma
**Total Pages:** 156 | **Total API Routes:** 346

---

## Table of Contents

1. [Authentication & Middleware](#authentication--middleware)
2. [Root Layout & Navigation](#root-layout--navigation)
3. [Public Routes by Feature](#public-routes-by-feature)
4. [Admin/Protected Routes](#adminprotected-routes)
5. [API Routes by Domain](#api-routes-by-domain)
6. [Issues & Dead Imports](#issues--dead-imports)

---

## Authentication & Middleware

### Auth Configuration
- **File:** `/auth.ts` (8957 bytes)
- **Provider:** NextAuth v5 + Prisma Adapter
- **Methods:**
  - Email/Magic link via Nodemailer (configurable SMTP)
  - Credentials provider (password-based)
- **MFA Support:** `/api/auth/mfa/setup`, `/api/auth/mfa/verify`, `/api/auth/mfa/disable`
- **Session:** NextAuth session stored in database, retrieved via `await auth()`

### Key Env Vars
```
AUTH_URL / NEXTAUTH_URL     # Callback URL
AUTH_SECRET                 # Session signing key
EMAIL_SERVER_HOST           # SMTP host
EMAIL_SERVER_PORT           # SMTP port (587 or 465)
EMAIL_SERVER_USER           # SMTP user
EMAIL_SERVER_PASSWORD       # SMTP password
EMAIL_FROM                  # From: header (default: T-Agent <support@tolley.io>)
SYNC_SECRET                 # Query param bypass for sync-only routes
```

### Protected Route Patterns
- `await auth()` — Get current session, redirect if missing
- `requireAdminPageSession()` — Verify admin on page (used in `/account`, `/credit`, `/manus`)
- Query param `key=SYNC_SECRET` — Bypass auth for sync webhooks (used in `/leads`, `/api/leads/dossier/process`)

---

## Root Layout & Navigation

### File: `/app/layout.tsx`
- **Metadata:** "t-agent | Real Estate Unlocked"
- **Fonts:** Sora (primary), JetBrains Mono (mono)
- **Analytics:** GA4 + Meta Pixel + Vercel Speed Insights
- **Footer (Fixed):** Links to Privacy, Terms, W&D Rental, Trailer, Generator, Pools
- **Root wrapper:** `<AuthSessionProvider>` (enables session access in client components)

### Navigation Hierarchy
```
/ (homepage) — HpNavbar (shows auth state, login/signup links)
  ├─ HpHero
  ├─ HpSocialProof
  ├─ HpFeatures
  ├─ HpHowItWorks
  ├─ HpDemo
  ├─ HpPricing
  ├─ HpTestimonials
  ├─ HpFaq
  ├─ HpCta
  └─ HpFooter

Legal footer (all pages):
  Privacy | Terms | W&D | Trailer | Generator | Pools
```

---

## Public Routes by Feature

### Real Estate - Leads (36 routes)
**Primary feature for T-Agent SaaS.** Unified CRM for real estate agents.

**Main Pages:**
- `/leads` — Unified pipeline (SYNC_SECRET bypass OR auth required)
- `/leads/[id]` — Lead detail view
- `/leads/dashboard` — Dashboard/overview
- `/leads/crm` — CRM interface (deals, activities, smart lists)
- `/leads/dossier` — Address lookup & enrichment
- `/leads/unclaimed` — Unclaimed funds finder
- `/leads/content` — Content creation (campaigns, posts, templates)
- `/leads/sms` — SMS sequences & sending
- `/leads/sequences` — Lead nurture workflows
- `/leads/narrpr` — NarrPR integration (public enrichment)

**Sub-routes (requires auth):**
- `/leads/clients` — Client relationships
- `/leads/comps` — Comparable sales lookup
- `/leads/matches` — Lead/property matching
- `/leads/deals` — Pipeline deals
- `/leads/conversations` — SMS/email threads
- `/leads/email` — Email templates & sequences
- `/leads/farm-mail` — Farming postcards/mailers
- `/leads/fsbo` — For-sale-by-owner targeting
- `/leads/open-house` — Open house leads
- `/leads/snap` — Photo → dossier pipeline
- `/leads/analytics` — KPIs & performance
- `/leads/settings` — Integration settings
- `/leads/scripts` — Call scripts
- `/leads/workflow` — Workflow builder
- `/leads/showings` — Showing management
- `/leads/onboard` — Onboarding checklist
- `/leads/pricing` — Pricing info
- `/leads/connects` — Integration marketplace
- `/leads/demo` — Product demo

**API:** 30 endpoints (CRM, dossier, enrichment, sync, workflows)

---

### Trading & Crypto (5 routes)
- `/crypto` — Crypto dashboard (requires redirect/auth)
- `/markets` — Market intelligence & signals
- `/trading` — Trading god-mode [ADMIN]
- `/trading/[assetClass]` — Asset class dashboard [ADMIN]
- `/trading/[assetClass]/live` — Real-time ticker
- `/trading/simulations` — Trading simulator [ADMIN]
- `/trading/god-mode` — Admin trading interface [ADMIN]

**API:** 14 endpoints (trades, strategies, predictions, wallet, optimizer, signals, live feeds)

---

### Pool Supply & Water (8 routes)
- `/pools` — Pool supply storefront (public)
- `/pools/[sku]` — Product detail
- `/pools/admin` — Admin dashboard [ADMIN]
- `/water` — Pool water chemistry advisor [ADMIN]
- `/water/calculator` — Dosing calculator (public)
- `/water/costs` — Cost tracker [ADMIN]
- `/water/inventory` — Equipment inventory [ADMIN]
- `/water/readings` — Chemical readings [ADMIN]

**API:** 9 endpoints (sync, orders, items, competitor pricing, enrichment, checkout, tracking)

---

### Shop & E-commerce (16 routes)
- `/shop` — eBay/resale storefront (wife's FB Marketplace integration)
- `/shop/admin` — Admin dashboard [ADMIN]
- `/shop/dashboard` — Seller analytics (affiliates, trends, arbitrage)
- `/vater` — Vater Hub (courses, dropship, YouTube, gov bids, merch)
- `/vater/chat` — Chat interface
- `/vater/courses` — Course platform (newdad, pilot)
- `/vater/dropship` — Dropship tools
- `/vater/govbids` — Government bid finder
- `/vater/merch` — Merchandise sales
- `/vater/youtube` — YouTube automation

**API:** 25 endpoints (products, listings, lots, affiliates, analytics, arbitrage, suppliers, checkout, scan-progress, trends)

---

### Delivery & Last-Mile (11 routes)
- `/drive` — Main dispatch UI (quote, driver registration, tracking)
- `/drive/admin` — Admin dashboard
- `/drive/dashboard` — Driver/order analytics
- `/drive/driver` — Driver portal (docs, earnings, orders)
- `/drive/quote` — Instant quote calculator
- `/drive/register` — Driver signup
- `/drive/track/[id]` — Public order tracking
- `/lastmile` — Last-mile CTA/landing

**API:** 26 endpoints (orders, matching, compliance, driver docs, payouts, SMS webhooks, quotes, client profile)

---

### Food / Ruthann's Kitchen (18 routes)
Family meal planning & grocery management (Ruthann's system).

- `/food` — Main hub (auth required)
- `/food/groceries` — Grocery lists & items
- `/food/pantry` — Pantry inventory
- `/food/recipes` — Recipe library (searchable, cost-tracked)
- `/food/recipes/new` — Recipe creation
- `/food/recipes/[slug]` — Recipe detail
- `/food/plan` — Meal planning
- `/food/cook/[slug]` — Cook mode (step-by-step)
- `/food/cookbooks` — Saved cookbooks
- `/food/curbside` — Curbside pickup tracking
- `/food/scan` — Receipt scanning
- `/food/prep` — Meal prep assistant
- `/food/analytics` — Spending & nutrition
- `/food/family` — Family settings
- `/food/tonight` — Tonight's dinner picker
- `/food/feed` — Recipe feed
- `/food/savings` — Cost tracker
- `/food/settings` — Food settings

**API:** 35 endpoints (groceries, recipes, plans, pantry, members, scan/import, analytics, alerts, chat advisor)

---

### Asset Rentals (10 routes)
- `/rental` — Rental hub (generic)
- `/wd` — Washer/Dryer rental (agent "Rental")
  - `/wd/admin` — Admin dashboard
  - `/wd/privacy`, `/wd/terms` — Legal
- `/trailer` — Trailer rental
  - `/trailer/admin` — Admin dashboard
  - `/trailer/privacy`, `/trailer/terms` — Legal
- `/generator` — Generator rental
  - Layout uses `GeneratorHero` component

**API:**
- W&D: auth, clients, repairs, stripe, upload
- Rentals: bookings (GET/POST/[id])

---

### Billing & Finance (13 routes)
**Credit Command Center & Invoicing**

- `/account` — Xero Ledger admin [ADMIN]
- `/account/accounts` — Bank/credit accounts
- `/account/contacts` — Payees/vendors
- `/account/income` — Income tracking
- `/account/invoices` — Invoice list/creation
- `/account/invoices/new` — Create invoice
- `/account/invoices/[id]` — Invoice detail
- `/account/invoices/[id]/print` — Print invoice
- `/account/reports` — Balance sheet, P&L
- `/account/tax` — Tax categories & summary
- `/account/transactions` — Transaction ledger
- `/credit` — Credit Command Center [ADMIN]
  - Dashboard: scores, cards, utilization, payment optimizer, court monitor (planned)
- `/billing/success` — Post-checkout confirmation

**API:**
- Account: 17 endpoints (sync, transactions, invoices, reports, reconciliation, webhooks/stripe)
- Credit: 12 endpoints (scores, cards, disputes, court, goals, recommendations, tactics, violations, chat advisor)
- Billing: 3 endpoints (checkout, portal redirect, status)

---

### Content & Video (5 routes)
- `/video` — Video generation/studio
- `/video/studio` — Creator workspace [ADMIN]
- `/content/upload` — Upload page [ADMIN]

**API:** 13 endpoints (posts, templates, campaigns, platforms, publish, generate, connect, callback)

---

### Legal & Auth (5 routes)
- `/` — Homepage (public, with nav showing auth state)
- `/login` — Login page
- `/login/mfa-challenge` — MFA prompt (post-password)
- `/signup` — Sign up
- `/privacy` — Privacy policy
- `/terms` — Terms of service
- `/security` — Security info
- `/data-retention` — Data retention policy

**API:** 5 endpoints (`/api/auth/[...nextauth]`, register, MFA setup/verify/disable)

---

### Tools & Utilities (20 routes)
- `/admin` — Admin hub [ADMIN]
- `/agents` — Agent management (auth required)
- `/manus` — OpenManus agent system [ADMIN]
- `/media` — Plex/media browser [ADMIN]
- `/settings` — User settings (auth required)
- `/junkinjays` — Junk removal service
- `/junkinjays/analytics` — Junk service analytics (auth)
- `/moupins` — Moupin service (unknown feature)
- `/moupins/analytics` — Moupin analytics (auth)
- `/picnic-table` — Picnic table builder/sales?
- `/scan` — Universal scan/lookup interface
- `/start` — Onboarding/start page
- `/start/analytics` — Start page analytics (auth)
- `/results/[id]` — Result detail view (generic)
- `/advertising` — Ad management/info
- `/homes` — Real estate listing search
- `/hvac` — HVAC service info
- `/kerplunk` — Unknown feature (public page)
- `/tables` — Data table component library?
- `/pay/[invoiceNumber]` — Public invoice payment link

**API:** Multiple (ask, chat, memory, mcp, feedback, debug-config, search, clients, agents, analytics, manus, junkinjays)

---

## Admin/Protected Routes

### Authentication Checks
- **`await auth()`** — Returns session or null; followed by `if (!session) redirect("/login")`
- **`requireAdminPageSession()`** — Custom function; used in:
  - `/account/*` (Xero Ledger)
  - `/credit/*` (Credit Command Center)
  - `/manus/*` (OpenManus)
  - `/media/*` (Plex admin)
  - `/trading/*` (Trading dashboards)
  - `/shop/admin`, `/pools/admin`, `/wd/admin`, `/rentals/admin`
  - `/video/studio`, `/content/upload`
  - `/rental` (?)

### Access Patterns
- **Public-with-logout:** Homepage, legal, pricing, demo
- **Public-with-login-prompt:** Lead dossier, SMS, content (some pages)
- **Subscriber-only:** Lead CRM, deals, conversations, sequences
- **Admin-only:** Account, credit, trading, OpenManus, media
- **Role-based:** Shop admin (shop_auth), W&D admin (wd_auth), etc.

---

## API Routes by Domain

### Overview
- **Total:** 346 endpoints
- **Top domains:** Food (35), Leads (30), Dispatch (26), Shop (25), Cron (20), Account (17), Content (13), Credit (12), Crypto (11), Analytics (11)

### LEADS (30 endpoints)
```
/api/leads                          # Root query
/api/leads/analytics                # KPIs & reporting
/api/leads/auto-responder           # Auto-responder config
/api/leads/auto-responder/trigger   # Webhook trigger
/api/leads/crm/*                    # Activities, deals, pipeline, smart-lists, tags, tasks
/api/leads/dossier/*                # Address lookup, batch, [id], process, enrich
/api/leads/digest                   # Daily digest
/api/leads/enrich                   # Lead enrichment
/api/leads/narrpr/*                 # NarrPR CSV/rich lookup
/api/leads/onboard                  # Subscriber onboarding
/api/leads/remine-import            # ResMine import
/api/leads/subscribe                # Subscription management
/api/leads/sync                     # Sync with external CRM
/api/leads/workflow, /workflows/*   # Workflow CRUD & execution
```

### TRADING (14 endpoints)
```
/api/trading/[assetClass]           # OHLC, positions
/api/trading/[assetClass]/live      # WebSocket/live feed
/api/trading/analytics              # Performance metrics
/api/trading/capital                # Account capital & risk
/api/trading/chat                   # Trading advisor
/api/trading/notifications          # Trade alerts
/api/trading/summary                # Portfolio summary
/api/trading/simulations/*          # Backtest engine (fork, report, signals, stream, agents, interrogate)
```

### DISPATCH (26 endpoints)
```
/api/dispatch/admin/*               # Dashboard, documents, driver approval
/api/dispatch/client/*              # Client location, profile
/api/dispatch/compliance/check      # KYC/compliance
/api/dispatch/driver/*              # Driver auth, docs, earnings, orders, payout, status
/api/dispatch/match                 # Order-driver matching
/api/dispatch/orders/*              # Order CRUD, accept, decline, rate, cancel
/api/dispatch/quote                 # Rate quote
/api/dispatch/sms/webhook           # Twilio callback
```

### SHOP (25 endpoints)
```
/api/shop/products*                 # Product CRUD, bulk, enrichment, listing, AI-enrich
/api/shop/items*                    # Item variants
/api/shop/listings*                 # eBay/marketplace listings
/api/shop/lots*                     # Lot management
/api/shop/affiliate*                # Affiliate tracking & clicks
/api/shop/analytics/*               # Revenue, platform stats
/api/shop/comps                     # Competitive pricing
/api/shop/suppliers*                # Supplier management
/api/shop/trends                    # Market trends
/api/shop/checkout                  # Stripe checkout
/api/shop/sales                     # Sales summary
/api/shop/scan-progress             # Inventory scan status
/api/shop/upload                    # Bulk upload
/api/shop/auth                      # Shop login
```

### FOOD (35 endpoints)
```
/api/food/alerts                    # Price/availability alerts
/api/food/analytics/*               # Spending, pricing trends
/api/food/chat                      # AI food advisor
/api/food/curbside                  # Pickup tracking
/api/food/family                    # Family settings
/api/food/groceries*                # Grocery lists, items, generation
/api/food/household                 # Household sharing
/api/food/members*                  # Family members
/api/food/pantry*                   # Inventory, bulk, restock
/api/food/plan/*                    # Meal plan CRUD, generation, slots
/api/food/prep                      # Meal prep
/api/food/recipes*                  # Recipe CRUD, cost, photo, nutrition, suggest
/api/food/savings                   # Savings tracker
/api/food/scan/*                    # Receipt scanning, import
/api/food/tonight                   # Tonight's meal suggestion
```

### POOLS (9 endpoints)
```
/api/pools/checkout                 # Stripe checkout
/api/pools/competitor-prices        # Price tracking
/api/pools/enrich                   # Product enrichment
/api/pools/items*                   # Product CRUD
/api/pools/orders                   # Order list
/api/pools/sync                     # Pool Corp sync
/api/pools/sync-log                 # Sync history
/api/pools/track                    # Usage tracking
```

### CRYPTO (11 endpoints)
```
/api/crypto                         # Market overview
/api/crypto/drives*                 # Scan results
/api/crypto/live                    # Live prices
/api/crypto/market                  # Market data
/api/crypto/mode                    # Trading mode toggle
/api/crypto/optimizer               # Portfolio optimizer
/api/crypto/predictions             # AI predictions
/api/crypto/strategies              # Strategy library
/api/crypto/trades                  # Trade log
/api/crypto/wallet                  # Wallet balance/address
```

### CONTENT (13 endpoints)
```
/api/content/campaigns*             # Content campaign CRUD
/api/content/posts*                 # Post CRUD, publish, generate
/api/content/templates*             # Template CRUD, seed (example templates)
/api/content/platforms*             # Platform config (YouTube, TikTok, etc), connect, callback
```

### CREDIT (12 endpoints)
```
/api/credit                         # Overview
/api/credit/cards                   # Card data (Plaid)
/api/credit/chat                    # AI advisor
/api/credit/court                   # Court records
/api/credit/disputes                # Dispute tracker
/api/credit/disputes/letter         # Dispute letter generator
/api/credit/goals                   # Goals/targets
/api/credit/legal                   # Legal actions
/api/credit/recommendations         # Action recommendations
/api/credit/scores                  # Credit scores (Experian, etc)
/api/credit/tactics                 # Strategy suggestions
/api/credit/violations              # Credit violations
```

### ACCOUNT (17 endpoints)
```
/api/account/accounts               # Bank/card accounts (Plaid)
/api/account/contacts               # Vendors/payees
/api/account/income                 # Income summary
/api/account/invoices*              # Invoice CRUD, send, next-number
/api/account/overview               # Dashboard
/api/account/reconciliation         # Reconciliation status
/api/account/reports/*              # Balance sheet, P&L
/api/account/sync                   # Xero sync
/api/account/tax-categories         # Tax categorization
/api/account/transactions*          # Transaction CRUD, import
/api/account/webhooks/stripe        # Stripe webhook (invoice creation)
```

### CRON (20 endpoints)
Automated background jobs triggered by external scheduler (Vercel Cron, AWS Lambda, etc).

```
/api/cron/auto-responder-reset      # Reset lead auto-responder daily
/api/cron/content-publish           # Publish queued content
/api/cron/crypto-sync               # Fetch crypto prices
/api/cron/dispatch-compliance       # KYC compliance checks
/api/cron/dispatch-match            # Order-driver matching
/api/cron/dispatch-payouts          # Settlement & payouts
/api/cron/dispatch-stale            # Expire old orders
/api/cron/dossier-cleanup           # Purge old dossier records
/api/cron/fb-sync                   # Facebook ads/page sync
/api/cron/market-collect            # Market data collection
/api/cron/mls-sync                  # MLS listing sync
/api/cron/pools-intelligence        # Pool competitor pricing
/api/cron/regrid-scan               # RegGrid property scan
/api/cron/sequence-process          # SMS/email sequences
/api/cron/shop-intelligence         # E-commerce trends
/api/cron/sms-reset                 # Reset SMS rate limits
/api/cron/token-refresh             # Refresh OAuth tokens
/api/cron/trading-sim-sync          # Backtest data sync
/api/cron/trading-sync              # Live trading sync
/api/cron/unclaimed-compliance      # Unclaimed funds state compliance
```

### Other Domains (Smaller)
- **ANALYTICS (11):** ads, adspend, facebook, ga4, leads, neon, pools, stripe, video
- **ADMIN (1):** `/api/admin/openclaw/[...path]` — OpenClaw gateway
- **AUTH (5):** nextauth, register, MFA
- **BILLING (3):** checkout, portal, status
- **CLIENT (5):** geo, listings, pois, signup, weather
- **CLIENTS (6):** CRUD, disc (discovery), enrich, matches, notes, triggers
- **AGENTS (2):** list, detail
- **DRIVE (3):** payouts settle, bank link-token, bank connect
- **REGRID (4):** lookup, owner, scan, stats
- **UNCLAIMED (8):** scan, claim, outreach, stats, callback
- **VATER (4):** arbitrage CRUD, upload, chat
- **RENTALS (2):** bookings
- **SMS (3):** conversations, send, webhook
- **SNAP (3):** upload, [id], resolve
- **WATER (4):** advisor, config, costs, devices, inventory, readings, weather
- **VIDEO (8):** credits, critique, generate, history, purchase, status, studio-generate, upload
- **WEBHOOKS (1):** facebook
- **STRIPE (1):** webhook
- **MEMORY (4):** get, save, update, forget
- **POI (1):** sync
- **PAY (1):** [invoiceNumber]
- **MARKET (1):** [assetClass]/live, etc
- **MCP (1):** MCP server proxy
- **SCAN (6):** activity, arbitrage, leads, markets, products, summary
- **SEARCH (1):** Generic search
- **ASK (1):** Claude chat endpoint
- **CHAT (1):** Generic chat endpoint
- **FEEDBACK (1):** User feedback
- **DEBUG-CONFIG (1):** Debug info
- **JUNKINJAYS (1):** Junk removal service

---

## Issues & Dead Imports

### Known Issues

1. **Missing Env Checks**
   - Email server config logged only once but not validated on startup
   - `AUTH_SECRET` allows dev-only fallback in prod (line 18-22 of `/auth.ts`)
   - No validation that `/api/webhook/stripe`, `/api/webhooks/facebook` have signing keys

2. **Middleware Missing**
   - No `middleware.ts` found in root or `/app`
   - Auth is checked per-route (not globally)
   - No automatic redirect from authenticated users back to `/app` after login

3. **Potential Dead Code**
   - `/api/debug-config` — No known consumers
   - `/api/mcp` — MCP proxy endpoint; unclear if used
   - `/api/ask` — Claude API endpoint; may be replaced by `/api/chat`
   - `/kerplunk/page.tsx` — Purpose unclear, no components referenced
   - `/hvac/page.tsx` — Purpose unclear
   - `/picnic-table/page.tsx` — Purpose unclear
   - `/advertising/page.tsx` — Purpose unclear
   - `/moupins/page.tsx` — Purpose unclear
   - `/tables/page.tsx` — May be component library demo (no layout.tsx)

4. **Routing Edge Cases**
   - `/food` requires auth but homepage shows link in footer → 404 if not logged in
   - `/leads` accepts `?key=SYNC_SECRET` but only works if env var set (no error msg if missing)
   - `/pay/[invoiceNumber]` might conflict with `/pay` route if it exists

5. **Auth Pattern Inconsistency**
   - Some pages use `await auth()` + redirect
   - Some use custom `requireAdminPageSession()`
   - Some use query param bypass (`?key=SYNC_SECRET`)
   - No centralized middleware to enforce

6. **Database Risk**
   - `/api/food/*` interacts with Ruthann's Kitchen data (family meal planning)
   - Per CLAUDE.md: "NEVER drop Food tables" — Real family data
   - Consider adding Prisma migration locks or backup triggers

7. **Stripe Webhook**
   - `/api/account/webhooks/stripe` and `/api/stripe/webhook` both exist
   - Unclear which is canonical; may cause duplicate processing

---

## Summary

**tolley-site** is a sprawling, multi-tenant SaaS platform with 5+ core businesses:
1. **T-Agent** — Real estate agent CRM (leads, enrichment, content, workflows)
2. **Trading/Crypto** — Backtesting, signals, portfolio optimizer
3. **E-commerce/Shop** — eBay resale, arbitrage, affiliate tracking
4. **Dispatch** — Last-mile delivery, driver marketplace
5. **Food/Ruthann's Kitchen** — Family meal planning & budgeting

Plus adjacent services: pools, crypto trading, credit management, asset rentals (W&D, trailer, generator), unclaimed funds finder, and video generation.

**Architecture:**
- NextAuth (email + credentials)
- Prisma ORM (multi-schema database)
- 346 API endpoints (mostly REST, some streaming)
- Cron-driven background jobs
- Stripe + Plaid integrations

**Maintenance Risk:**
- Many young, experimental features (kerplunk, moupins, picnic-table)
- Food data is real family data (no drop zones)
- No global middleware → auth enforcement scattered
- 156 pages make refactoring dangerous without good tests

