# Handoff: Jelly Studio "Cinema" Landing & Site Design Language

## Overview
A full redesign direction for tolley.io/animate (Jelly Studio): a modern dark 3D "cinema" aesthetic — projector light, film strips, title cards, reels, box-office ticket — built around the product truths: real cinematic films about people's lives, pay-per-render, no subscription. The centerpiece deliverable is the landing page; the design language (tokens, motifs, components below) is intended to roll out across the ENTIRE site: marketing pages, the studio app shell, pricing/billing screens, emails.

Target codebase: `digiegold-rgb/tolley-site` (Next.js App Router). Landing lives at `app/animate/page.tsx` with components in `components/animate/` (there is an existing `components/animate/landing/` folder and a `tokens.ts`). Brand assets already exist at `public/animate/brand/`.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, NOT production code to copy directly. The task is to **recreate these designs in the tolley-site Next.js codebase** using its established patterns (React components, `components/animate/primitives.tsx`, `tokens.ts`, existing theme context). The 3D background is plain three.js and can be ported nearly as-is into a client component.

## Fidelity
**High-fidelity.** Colors, typography, spacing, copy, and interactions are final intent. Recreate pixel-perfectly, but express tokens through the codebase's existing token system (`components/animate/tokens.ts`) rather than hardcoding.

## Design Tokens
Colors:
- Background base: `#0A0A14`; deep panel: `#08070F`; nebula tint: `#1B1533`
- Text primary: `#F0EEF8`; text secondary: `#9A94B0`; text faint: `#6B6584`; disabled/dim: `#4A4560`
- Accent violet: `#8F7DFF` (light `#B3A6FF`); accent cyan: `#6FD6FF`
- Primary gradient: `linear-gradient(120deg, #8F7DFF, #6FD6FF)` (text-on-gradient: `#0A0A14`)
- Hairlines: `rgba(240,238,248,0.10–0.14)`; glass fill: `rgba(240,238,248,0.04)` + `backdrop-filter: blur(10px)`
- Glows: `rgba(143,125,255,0.35)` button shadow; `rgba(143,125,255,0.25)` card halo

Typography:
- Headings/UI: **Space Grotesk** (400/500/600/700), tight tracking on display sizes (−0.02 to −0.03em)
- Cinematic accent: **Instrument Serif italic** — used ONLY for title cards, hero accent phrase, "Directed by you."
- Display: clamp(46px, 5.4vw, 74px) hero; clamp(34px, 4vw, 52px) section H2; body 16–17.5px / 1.7
- Micro-labels: 10.5–12px, letter-spacing 0.22–0.3em, uppercase (e.g. "ACT I — THE STORY", "— TITLE CARD —")

Radii: pills 999px; cards 14–20px; small plates 10–12px.
Shadows: cards `0 40–50px 80–100px rgba(0,0,0,0.5–0.65)`; hero card adds `0 0 60px rgba(143,125,255,0.25)`.

## Signature Motifs (reuse site-wide)
1. **Projector beam**: fixed conic-gradient wedge from top-left, violet→cyan, with a subtle "flicker" keyframe (opacity dips at 92–98%).
2. **Space dust**: three.js additive-blended point clouds in 3 depth bands (violet `0x8f7dff`, cyan `0x6fd6ff`, pale `0xcfc4ff`), slow rotation, scroll pushes bands forward at different rates (parallax), mouse eases camera ±0.7. See `space-field.js` — port as a `<SpaceField />` client component; render behind everything, `position:fixed`, `pointer-events:none`.
3. **Film strip frame**: media cards framed by sprocket rails — 20px rails with `radial-gradient(circle at 13px 50%, #1B1533 5px, transparent 6px)` repeating every 30px on `#08070F`.
4. **Title card**: glass panel, "— TITLE CARD —" micro-label, Instrument Serif italic quote (26px/1.4, reserve 2 lines), meta line below.
5. **Marquee strip**: 1px-hairline-bounded band, 12.5px/0.22em uppercase items separated by ✦, translateX(−50%) loop, 30s linear.
6. **Reel spinner**: 34px circle, violet border, 5 hole dots (radial-gradients), `rotate 360deg / 14s linear infinite`.
7. **Ticket / live meter**: "ADMIT ONE — LIVE METER" card with ticking dollar amount (see Interactions).

## Screens / Views (landing page, top to bottom)
1. **Nav**: logo (`public/animate/brand/logo.svg`, 34px, violet drop-shadow glow) + "JELLY STUDIO" 700/0.12em + "public beta" pill; links Stories / The reels / Box office; gradient pill CTA "Request an invite".
2. **Hero** (2-col grid 1.05fr/0.95fr, 64px top pad):
   - Left: pill eyebrow "✦ FEATURE PRESENTATION · NO SUBSCRIPTION ✦" (violet border/tint); H1 "Your life is already *a motion picture.* / We just develop the film." (italic phrase in gradient-clipped Instrument Serif); paragraph (lives-not-niches copy, "$1–7 all in" bolded); CTAs "Roll camera" (gradient pill) + "Pick a story ↓" (ghost pill); microcopy "$10 starter credit on signup · nothing charged until you spend it".
   - Right: perspective(1200px) stack of three floating 16:9 film cards (offsets: back `left:10%;top:0`, mid `left:5%;top:64px`, front `left:0;right:10%;top:150px;height:300px`), each bobbing with its own float keyframe at rotateY(−14/−22/−28deg) and translateZ(0/−90/−180px). Front card has sprocket rails top+bottom, real demo frame, and a glass caption plate: "The Quiet Exit / a film about one payday · 3:24 — $3.04" (price in cyan). Back cards are droppable/placeholder slots for more demo frames. IMPORTANT sizing lesson from the prototype: media fills its frame via `position:absolute; inset:0` (intrinsic aspect-ratio will otherwise blow out grid tracks).
3. **Marquee**: NOW SHOWING ✦ NO SUBSCRIPTION ✦ NO WATERMARK ✦ YOUR VOICE, CLONED ✦ NO STOCK FOOTAGE, EVER ✦ FAILED RENDERS $0.00.
4. **Act I — The Story** (`#stories`, centered): H2 "What picture will you make first?"; sub "Not niches. Not trends. The stuff of an actual life. Tap one."; 8 selectable chips → selecting updates the Title Card below. Chips + title lines + prices:
   - My money story → "The Quiet Exit — how I finally stopped living for payday." $3.04
   - The year everything changed → "Twelve Months — the year that split my life into before and after." $4.20
   - Our family history → "The Kitchen Table — four generations, one recipe, every argument." $5.10
   - Grief & what came after → "What She Left — the things I only understood once she was gone." $3.80
   - The comeback → "Round Two — losing everything was the easy part." $4.60
   - How we met → "Aisle Nine — a love story that started over spilled coffee beans." $2.90
   - Lessons from my father → "His Hands — everything my father taught me without saying a word." $4.40
   - Starting over at 40 → "Second Act — the reinvention nobody saw coming, including me." $5.56
   Selected chip: gradient tint bg, violet border, primary text; idle: glass bg, hairline border, secondary text.
   Title card meta: "narrated in your cloned voice · a generated scene for every line · typically {price} all in".
5. **Act II — The Making** (`#reels`): H2 "Five reels. You hold the pen the whole way." Grid auto-fit minmax(210px,1fr) of 5 glass cards, each: spinning reel icon + "REEL 0N" label, 17px/600 title, 13.5px/1.6 secondary copy. Hover: violet border + tint. Copy: Script / Voice / Scenes / Motion / Premiere (exact text in the prototype).
6. **Act III — The Box Office** (`#boxoffice`, 2-col): Left: H2 "One ticket. One film. No season pass."; paragraph (itemised receipt, $0.35/min ops, failed renders never charged, credit never expires); the decorative **"Cancel my subscription"** button → on click: border/text fade to dim, line-through, message "Nothing happened. There was never anything to cancel. Roll on." (cyan). Right: ticket card (violet-cyan gradient tint, violet border): "ADMIT ONE — LIVE METER" + blinking "● NOW FILMING", 64px/700 tabular fare ticking $0.00→$3.04, dashed dividers, 4 phase rows (your voice word-timed $0.28 / generated scenes × 9 $1.02 / motion 2 scenes $0.55 / render ops 3.4 min × $0.35 $1.19), footer "«The Quiet Exit» · 3:24 · a real render, a real receipt · overruns capped, we absorb the rest".
7. **Roll Credits CTA**: "— ROLL CREDITS —" label; gradient-clipped Instrument Serif italic "Directed by you."; invite paragraph; gradient CTA + ghost sign-in.
8. **Footer**: JELLY STUDIO · KANSAS CITY, MO · Terms · Privacy · v1.3 · public beta.

## Interactions & Behavior
- **Live meter**: interval tick (default 70ms, +2¢/tick) to 304¢, hold ~2s, loop. Phases activate by cumulative thresholds 28/130/185/304¢; active row cyan with ▸, done rows ✓ secondary, pending · dim. State label flips to "FADE TO BLACK — MP4 READY" at completion.
- **Story chips**: single-select, updates title card text + price instantly.
- **Cancel button**: one-way state; see copy above.
- **Scroll reveals**: sections rise 56px + fade on entry (CSS scroll-driven `animation-timeline: view(); animation-range: entry 0% entry 50–55%`; acceptable fallback: IntersectionObserver or simple load animation).
- **Float cards**: 5–7s ease-in-out bob loops, staggered.
- **Space field**: scroll parallax + mouse ease (see space-field.js).
- Respect `prefers-reduced-motion`: disable marquee, floats, meter can render final state.

## State Management
Landing needs only local state: `selectedStory` (index), `meterCents` (interval), `cancelled` (bool). No data fetching. Site-wide rollout: express tokens in `tokens.ts` and reuse `primitives.tsx` patterns.

## Assets
- `public/animate/brand/logo.svg` (in repo)
- `public/animate/brand/poster-30s-1280x720.jpg` — demo frame used in hero (in repo; swap in more real render frames for the two placeholder cards)
- Fonts via Google Fonts / next/font: Space Grotesk, Instrument Serif (italic)
- three.js (npm dep) for the space field

## Files in this bundle
- `Jelly Studio Landing Space.dc.html` — the full landing design reference (open in a browser)
- `space-field.js` — three.js particle background (portable logic)
- `poster-30s-1280x720.jpg`, `logo.svg` — copies of the brand assets used

## Site-wide rollout guidance
Apply the same language everywhere: dark `#0A0A14` base + projector beam on hero-level pages only; glass cards with hairlines for all panels; micro-label + H2 pattern for section headers; the ticket/receipt motif for ALL billing UI (receipts already exist in-product — style them as ADMIT ONE tickets); film-strip frames for any video thumbnails; Instrument Serif italic reserved for emotional/cinematic moments only. Never introduce new hues — stay on the violet/cyan pair.
