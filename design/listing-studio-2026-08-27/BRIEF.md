# Claude Design brief — "Listing Studio by Jelly!" (tolley.io/realestateanimated)

> Hand-off in the same shape as `design/jelly-cinema-2026-08-16/README.md`, read the other way round: that README told the codebase how to rebuild a design; this brief tells Claude Design what to draw so the codebase can drop it in. The paste-ready version is `PASTE-INTO-CLAUDE-DESIGN.txt` (also copied to `~/Shared/claude-design/listing-studio-brief.txt`).

## 1. Product truths (do not soften these)

- **What it is.** A second front door to the same studio (`/animate` = Jelly! Studio, `/realestateanimated` = Listing Studio by Jelly!). Same auth, same credit ledger, same render lanes. Only the brand, the default screen, the nav subset and the compliance rules change.
- **Who buys.** Real estate agents in the Midwest, many 45–70, on a phone in a driveway. They want "upload photo → click → pay → done". They do not want to learn anything.
- **What they get.** One photo of an empty room → a virtually staged photo ($4.99), a before→after reveal video ($19 Economy / $29 Photoreal), a room beauty shot ($14). Later: walkthrough tour ($79), exterior reveal ($29), agent character tour ($49/scene). Pay-as-you-go credit packs ($10/$25/$50/$100), one bundle ("Listing Launch", $99). No subscription. Failed renders are never charged.
- **The hook.** *Fair-Housing safe by default.* Equal Housing Opportunity on every export; "AI-generated · virtually staged" label burned on the frame; the agent's broker line sized and placed per their state's advertising rule; an MLS-safe export (bare still + "Virtually staged" text) gated on a verified license; a public proof page (original vs generated) per video.
- **The person.** Jared Tolley — licensed Missouri Salesperson (Lic #2024002937), Your KC Homes team, broker of record United Real Estate Kansas City, (816) 629-4494, Independence MO. Render his line as "Jared Tolley · Your KC Homes team · United Real Estate Kansas City · (816) 629-4494" — never "Your KC Homes" alone as the brokerage (MO 20 CSR 2250-8.070). "I'm not selling something I don't use." Support = his phone (call / text), 8a–8p Central, 7 days. The landing shows his real 30-day view count when it is available and **hides the number otherwise** — never a made-up figure.
- **Naming rules (NAR marks).** The product name and URL never contain "Realtor". Copy may say "for real estate agents and, for NAR members, REALTORS®". "REALTOR®" appears after an agent's name only when they ticked "I am an NAR member" AND their license is verified.

## 2. Precedent

`design/jelly-cinema-2026-08-16/README.md` — the Jelly! Studio "Cinema" language: dark stage, projector beam, glass panels with hairlines, film-strip frames, title cards, reel spinner, and the **ADMIT ONE ticket** for every billing surface. Listing Studio keeps the *structure* (glass, ticket, micro-labels, film frames) and swaps the *palette and tone*: from violet/cyan cinema to navy/gold "professional real estate" — trustworthy, warm, legible at arm's length. Serif italic accents stay (Instrument Serif) but are used for reassurance ("done for you"), not drama.

## 3. Tokens — the exact contract

Colour is delivered as CSS variables on the product layout. `components/animate/tokens.ts` reads `var(--jb-<name>, <jelly fallback>)`; everything under `components/animate/**` (≈115 files) consumes tokens, so **returning these variables is the whole colour hand-off.** Current placeholder values (navy / gold / ivory) from `components/animate/brands.ts`:

### Dark (default — the studio and the landing)

| Variable | Placeholder | Used for |
|---|---|---|
| `--jb-brand` | `#1F5FA8` | primary brand (buttons, active borders) |
| `--jb-brand-light` | `#4F86CC` | eyebrow text, micro-labels, links on dark |
| `--jb-brand-dark` | `#0B1F3A` | deep brand, ticket gradient end |
| `--jb-brand-ghost` | `rgba(31,95,168,0.14)` | tinted fills (eyebrow pill, outline buttons) |
| `--jb-brand-outline` | `rgba(31,95,168,0.42)` | hairline on brand-tinted panels |
| `--jb-brand-glow` | `rgba(31,95,168,0.35)` | button shadow `0 12px 44px <glow>` |
| `--jb-cyan` | `#C9A24A` | the accent pair (prices, "●" state text, checkmarks) |
| `--jb-cyan-ghost` | `rgba(201,162,74,0.16)` | accent tinted fill |
| `--jb-accent` | `#C9A24A` | alias of cyan |
| `--jb-accent-dark` | `#9C7A2E` | pressed accent |
| `--jb-grad-primary` | `linear-gradient(135deg, #1F5FA8 0%, #C9A24A 100%)` | primary pill CTA, step number discs |
| `--jb-grad-text` | `linear-gradient(90deg, #4F86CC 0%, #C9A24A 100%)` | gradient-clipped headline phrase |
| `--jb-grad-ticket` | `linear-gradient(135deg, #0B1F3A 0%, #1F5FA8 100%)` | ADMIT ONE ticket background |
| `--jb-grad-chip-on` | `linear-gradient(135deg, #1F5FA8 0%, #4F86CC 100%)` | selected chip / active stepper pill |
| `--jb-grad-create` | `linear-gradient(135deg, #1F5FA8 0%, #C9A24A 100%)` | "Make a listing video" sidebar CTA |
| `--jb-grad-credits` | `linear-gradient(135deg, #C9A24A 0%, #9C7A2E 100%)` | credit balance chip |
| `--jb-grad-upgrade` | `linear-gradient(135deg, #0B1F3A 0%, #C9A24A 100%)` | upsell panels |
| `--jb-grad-tutorial` | `linear-gradient(135deg, #1F5FA8 0%, #0B1F3A 100%)` | tutorial card |
| `--jb-on-gradient` | `#FFFFFF` | text on any gradient (must pass AA on both ends) |
| `--jb-body` | `#0B1424` | page background |
| `--jb-card-alt` | `#111D33` | deep panel / media backdrop |
| `--jb-panel` | `#0E182B` | opaque panels (modals, dropdowns) |
| `--jb-nebula` | `radial-gradient(60% 50% at 20% 0%, rgba(31,95,168,0.35), transparent 70%)` | backdrop wash |
| `--jb-hover` | `rgba(255,255,255,0.06)` | hover tint |
| `--jb-link` | `#8FB4E8` | links |
| `--jb-sidebar-bg` | `#0B1424` | sidebar |
| `--jb-header-bg` | `rgba(11,20,36,0.85)` | sticky header |
| `--jb-halo` | `rgba(201,162,74,0.25)` | card halo `0 0 60px <halo>` |
| `--jb-hero-wash` | `radial-gradient(80% 60% at 50% 0%, rgba(31,95,168,0.30), transparent 70%)` | hero backdrop |

### Light (the studio's light theme — agents will use it in daylight)

| Variable | Placeholder |
|---|---|
| `--jb-body` | `#F7F4EC` |
| `--jb-card-alt` | `#FFFFFF` |
| `--jb-panel` | `#FBF9F3` |
| `--jb-nebula` | `radial-gradient(60% 50% at 20% 0%, rgba(31,95,168,0.12), transparent 70%)` |
| `--jb-hover` | `rgba(11,31,58,0.05)` |
| `--jb-link` | `#1F5FA8` |
| `--jb-sidebar-bg` | `#F1EDE2` |
| `--jb-header-bg` | `rgba(247,244,236,0.9)` |
| `--jb-halo` | `rgba(201,162,74,0.20)` |
| `--jb-hero-wash` | `radial-gradient(80% 60% at 50% 0%, rgba(31,95,168,0.10), transparent 70%)` |

Brand-family variables (`--jb-brand*`, `--jb-cyan*`, `--jb-grad-*`, `--jb-on-gradient`) are shared by both themes — pick values that hold up on `#0B1424` **and** `#F7F4EC`.

Fixed (not variables): text on dark `#F0EEF8` / `#9A94B0` / `#6B6584`; text on light `#14122A` / `#5C5878` / `#7A7694`; hairlines `rgba(240,238,248,0.10–0.16)` dark, `rgba(20,18,42,0.10–0.16)` light; status colours success `#34C98A`, warning `#F5B34B`, error `#F0607A` (unchanged across brands). `themeColor` (mobile chrome) currently `#0B1F3A`.

### Typography

- Google Fonts only (loaded via `next/font/google` in `components/animate/fonts.ts`; the variables `--font-jelly-display` and `--font-jelly-serif` are shared by both products).
- Current: **Space Grotesk** (400/500/600/700) for UI/headings, **Instrument Serif** italic for accent phrases. You may propose a different Google pair for Listing Studio (e.g. a warmer grotesk + a bookish serif), but exactly two families, both on Google Fonts, both with a real fallback stack.
- Sizes: body **≥ 16 px** on the landing, **18 px inside the wizard**; titles `clamp(26px, 3.4vw, 34px)` in the wizard, `clamp(32px, 4vw, 48px)` for landing H2, hero `clamp(40px, 5.2vw, 70px)`; micro-labels 11–12 px / 0.22–0.26em uppercase (keep these — they are the studio's signature); tap targets ≥ 44 px, primary buttons 56 px tall.
- Radii: pills 999; cards 18–20; small plates 10–12. Glass: translucent fill + hairline + `blur(10px)`.

## 4. Slots to return (standalone HTML/CSS, each root carries `data-slot`)

Return every slot as one self-contained snippet (inline `<style>` or a shared `<style>` block using the `--jb-*` variables above — no external CSS, no JS frameworks, no CDN). The codebase maps each slot onto an existing React component; matching the `data-slot` name is what lets us diff.

| `data-slot` | What it is | Must contain |
|---|---|---|
| `hero` | Landing hero (2-col ≥ 920 px, stacked below) | headline with one gradient-clipped serif phrase; 18 px lede; primary pill "Get an invite" + ghost pill "See the 5 steps"; the media: a 16:9 film-frame (sprocket rails) holding a muted before→after video, with the on-frame label "AI-generated · virtually staged" bottom-left; under it a before/after slider (two stills, draggable divider, BEFORE / AFTER tags) |
| `living-proof` | Jared card + real-numbers ticket | avatar (photo or initials), name, "Jared Tolley · Your KC Homes team · United Real Estate Kansas City · (816) 629-4494" + "Licensed Missouri Salesperson, Lic #2024002937"; quote; a ticket-style stat card for `{views30d}` + "views across my real-estate socials in the last 30 days" + "as of {date}". Design both states: **with** the number and **without** (the card shows a 4-line "what you get" list instead — never a placeholder number) |
| `five-steps` | 5 numbered tiles | number disc on the primary gradient, 20 px title, 16 px body; wraps to 2–3 columns on phones |
| `sku-card` | One product card | title, price (accent colour, tabular), blurb, meta line ("12-second video · ready in about 6 minutes"), and ONE of two badges: green "MLS-safe copy included" or amber "For social & marketing — not for MLS photo slots". Design selected / unselected / disabled("Coming soon") states — the same card is used inside the wizard as a radio |
| `pricing-ticket` | The ADMIT ONE ticket, real-estate flavour | header "ADMIT ONE — LISTING STUDIO", big tabular fare, dashed dividers, itemised rows, notes ("Fair-Housing check · on every export", "Failed render · never charged"), footer fine print, and a full-width primary button "Pay $29 and start" INSIDE the ticket |
| `fair-housing-badge` | One of six checklist cards | ✓ + 18 px title + 16 px body. Also draw the compact **badge** version (pill/shield, ~28 px tall) that says "Fair-Housing safe" for use next to the logo and in the sidebar |
| `invite-form` | Request-an-invite form | name (optional) + email row, one textarea ("Your brokerage, your state, and how many listings a month"), SMS consent checkbox + phone, primary "Send me an invite"; done state "You're on the list — check your email." |
| `end-card-1280x720` | The 16:9 end card burned onto every video | line 1: `{agentName}[, REALTOR®] · Lic # {licenseNumber}`; line 2: `{brokerName} · {brokerPhone}` **adjacent** to line 1; Equal Housing Opportunity slogan **and** logo bottom-right (`public/animate/brand/eho.png` exists; draw a vector version too); Listing Studio mark small, bottom-left. See the font-ratio rule in §6 |
| `end-card-1080x1920` | The 9:16 end card (Reels/Shorts) | same content, safe-area aware (top 220 px and bottom 320 px are covered by platform UI) |
| `frame-label` | The on-frame label | "AI-generated · virtually staged" (and the variant "AI-generated · rendering" for Street-View exteriors) — bottom-left, black @ 55% plate, white text, must stay readable at 320 px thumbnail width; give px sizes as a % of frame height (currently 4.5% H) |
| `wizard-step-shell` | The frame every wizard step lives in | 5-pill stepper ("Photo · Address · Details · Video type · Look & price", active on `--jb-grad-chip-on`), "Step N of 5 · autosaved" line, the support strip, one glass card for the step body, Back (ghost) left / the single forward action (primary, 56 px) right. Draw it on a 390 px phone and at 1040 px |
| `support-strip` | Call / text row | "Need a hand? Call or text." · "Jared Tolley — licensed Missouri agent — answers himself · 8a–8p Central, 7 days" · two pill buttons "📞 Call (913) 914-9429" and "💬 Text". Also the **expanded** failure state (bigger, "Stuck? A real person answers.") |
| `sidebar-lockup` | The studio sidebar identity | logo mark + "LISTING STUDIO" wordmark (700 / 0.12em) + eyebrow "by Jelly!" + the compact Fair-Housing badge; 240 px wide sidebar, dark and light |

## 5. Assets to return (drop into `public/realestateanimated/brand/`)

| File | Spec |
|---|---|
| `logo.svg` | Mark, colour, square viewBox, works at 24 px and 512 px |
| `logo-mono-white.svg`, `logo-mono-black.svg` | 1-colour versions |
| `logo-lockup.svg` | Mark + "LISTING STUDIO" + "by Jelly!" horizontal lockup |
| `og-1200x630.png` | OG image: headline "One photo of an empty room. One listing video." + before/after split + Fair-Housing badge |
| `favicon-512.png` | Mark on `--jb-brand-dark` |
| `demo-poster.jpg` | poster treatment for the hero video (the real render + `demo-before.jpg` / `demo-after.jpg` already exist in `public/realestateanimated/brand/`; propose the split/label treatment) |
| `eho.svg` | Vector Equal Housing Opportunity logo (house + equals sign) in white and in `#14122A` |
| `fair-housing-badge.svg` | The compact badge from §4 |
| `tokens.json` | `{ "dark": { "--jb-brand": "#…", … }, "light": { … }, "themeColor": "#…", "fonts": { "display": "…", "serif": "…" } }` — every variable in §3, nothing else |

Existing references you can reuse: `public/animate/brand/logo.svg` (Jelly mark — the new mark should feel like a sibling, not a child), `public/animate/brand/endcard-1280x720.png` and `endcard-1080x1920.png` (Jelly end cards — same job, different brand), `public/animate/brand/eho.png`.

## 6. Constraints

1. **Contrast AA** for all text at its rendered size on both `--jb-body` values; `--jb-on-gradient` must pass on both ends of `--jb-grad-primary`.
2. **Body ≥ 16 px; wizard body 18 px; tap targets ≥ 44 px.** No text below 13 px except the on-frame label at thumbnail scale (which has its own rule).
3. **End-card font-ratio rule (state advertising law — not a style choice).** With `agent_fs` = agent-name size and `broker_fs` = broker-line size, at frame height H:
   - default: `agent_fs = 0.06·H`, `broker_fs = max(agent_fs / 2, 0.04·H)`, broker line **adjacent** (directly under) the agent line;
   - **Missouri (MO):** broker's licensed business name always present; if agent name or phone is shown, broker name **and phone** are shown;
   - **Kansas (KS):** broker name adjacent to agent/team name and `agent_fs ≤ 2 × broker_fs` (assert it);
   - **Pennsylvania (PA):** `broker_fs = agent_fs` (equal size), broker name + phone in the card itself;
   - unknown states use the PA rule. Design the card so all three read as the same family. Equal Housing Opportunity slogan + logo on every card, no exceptions.
4. **No people, no faces** in any illustrative frame (the video model refuses them and Fair Housing keeps them out of listing media). Rooms only.
5. **Never a hardcoded number** on the proof card; design the empty state explicitly.
6. **No "Realtor"** in the product name, logo, URL or wordmark.
7. **Respect `prefers-reduced-motion`**: static hero poster, no bobbing, no marquee.
8. Everything self-contained: no CDN scripts, no external stylesheets, Google Fonts only.

## 7. Return format

- One zip (or one canvas) containing: `slots/<data-slot>.html` (13 files, each openable on its own), `assets/` (§5), `tokens.json`, and a short `README.md` listing what you changed vs this brief and why.
- The codebase side (already built, waiting on the values): `components/animate/brands.ts` → `LISTING_CSS_VARS` / `LISTING_CSS_VARS_LIGHT` / `themeColor`, `components/animate/fonts.ts` for the font pair, `public/realestateanimated/brand/*` for assets, and the landing/wizard components under `components/animate/landing/ListingLanding.tsx` and `components/animate/screens/listing/*` (each already carries the `data-slot` names above so the hand-back is a diff, not a rebuild).
- Alternative if Jared prefers: run the `/design` skill canvas here with this brief as the prompt.
