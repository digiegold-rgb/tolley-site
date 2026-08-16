# `components/animate` — Jelly Studio

The signed-in product at **`/animate`**. This is the sellable surface: a
customer signs up, creates a style, writes a script, renders scenes, composes
a video and publishes it. Treat every button here as customer-facing.

## Route + rendering

- Page: `app/animate/page.tsx`. Signed-out visitors get
  `landing/AnimateLanding.tsx`; signed-in users get `Shell.tsx`.
- **Hash router, not Next routing.** `Shell.tsx` owns all navigation state and
  serialises it to `#r=<route>&s=<editorStep>&p=<projectId>&y=<styleId>`.
  `renderScreen()` maps `r` to a screen component. Back/forward work via
  `popstate`.
- Query params are consumed once on load for the Stripe card-on-file return
  (`?card_added=1` / `?card_cancelled=1`), which routes to Billing, flashes a
  `Toast`, and strips itself from the URL with `replaceState`.

## Tiers

`GET /api/vater/me` returns the caller's tier, capability flags and visible
route ids. `tier-context.tsx` mirrors it client-side; `useTier()` is the only
correct way to ask "may this user see X".

| Tier | Who | Extra surfaces |
| --- | --- | --- |
| `public` | any signed-in customer | dashboard, library, queue, recent, styles, project history, video editor, Creator Models, publishing, voices, billing |
| `studio` | `isVaterStudioEmail()` | + script review, Direct, Course Studio, Rules |
| `owner` | `isVaterAdminEmail()` / `isAdminEmail()` | + RSS Feeds, Autopilot, Discord Bot, Observer, cost pill |

The route→tier table lives in **`lib/vater/nav-visibility.ts`** (pure,
isomorphic — imported by both the Sidebar and the API route). `Sidebar.tsx`
renders `visibleRoutes(tier, showStubs)`; `Shell.renderScreen` refuses
out-of-tier routes with `NotAvailableScreen`. Routes absent from `NAV_ROUTES`
(`editor`, `styles-edit`, `styles-list`, `custom-art-styles`) are open to
everyone by design — they are sub-routes of a gated nav entry.

## Layout

Desktop: 260px sticky sidebar + main column. Below 1024px the sidebar starts
collapsed to its 68px icon rail. **Below 768px it leaves the layout entirely**
and becomes an off-canvas drawer opened by the Header hamburger
(`data-testid="nav-open"`) — the old fixed 260px column pushed every screen
into horizontal scroll on a 390px viewport. `Shell` owns the breakpoint via
`matchMedia` and closes the drawer on every route change.

The Shell root carries `className="animate-shell jelly-cinema"`.
`app/globals.css` keys the site-wide body bottom padding off `animate-shell`;
`jelly-cinema` scopes the `.jc-*` utilities in `app/animate/animate.css`. The
shell also mounts `<CinemaBackdrop density="sparse" />` as the fixed z0 stage
and sets `--jelly-*` CSS variables on the root for the legacy skin.

## Cinema design language

The whole studio speaks one visual language, handed off in
`design/jelly-cinema-2026-08-16/README.md`: a dark 3-D cinema — projector
light, film strips, title cards, reels, a box-office ticket — on a **violet /
cyan pair and nothing else**.

**Tokens** — `tokens.ts` is the only source of colour. `JELLY_TOKENS` carries
the brand pair (`brand` `#8F7DFF`, `brandLight`, `cyan` `#6FD6FF`, plus
`brandGhost` / `brandOutline` / `brandGlow` / `cyanGhost`), the gradients
(`gradPrimary`, `gradText`, `gradTicket`, `gradChipOn`, `onGradient`), `font` /
`fontSerif` / `fontMono`, `radius`, `shadow1/4/24`, `micro`, and `motion`.
Themed values live in the `light` / `dark` slices and are read through
`useTheme().t` — `body`, `card`, `cardAlt`, `panel`, `nebula`, `text`,
`textSecondary`, `textFaint`, `textDisabled`, `border`, `borderStrong`,
`hover`, `link`, `sidebarBg`, `headerBg`, `glassBlur`, `cardShadow`, `halo`,
`heroWash`. Two helpers: `glass(t)` (the translucent fill + hairline + blur
recipe every panel shares) and `microLabelStyle(color)`.

**Primitives** — `primitives.tsx`: `VBtn` (primary = gradient pill), `VCard`
(glass; `hero` adds the halo), `VInput`, `PillStepper`, `RetryError`,
`SectionHeader` (takes an `eyebrow`), `Toast`.

**Cinema components** — `cinema/`: `CinemaBackdrop` (fixed z0 stage: nebula
wash + three.js space dust, optional projector `beam`), `CinemaRoot` (the same
thing pre-wired for public pages), `MicroLabel`, `GradientText`, `GlassCard`
(`glass` | `ticket` | `panel`), `PillButton` (`gradient` | `ghost` | `outline`
| `subtle`), `Marquee`, `ReelSpinner`, `FilmFrame` + `FILM_MEDIA_STYLE`,
`TitleCard`, `AdmitOneTicket` (`hero` | `card` | `chip`).

**CSS utilities** — `app/animate/animate.css`, imported by the /animate layout:
`.jc-rise` / `.jc-rise-load` / `.jc-fadein` / `.jc-d1..d4`, `.jc-floatA/B/C`,
`.jc-blink`, `.jc-marquee-track`, `.jc-reel`, `.jc-flicker`, `.jc-spin`,
`.jc-glass-hover`, `.jc-nav-link`, `.jc-pill-gradient`, `.jc-pill-ghost`,
`.jc-chip`, `.jc-details`, `.jc-tabular`, `.jc-link`.

### Rules

- **Violet and cyan only.** Never introduce a hue. `success` / `error` /
  `warning` are semantic status colours, not brand colours — the "view as"
  bar is the one place red is allowed to lead, because impersonation must not
  read as decoration.
- **Instrument Serif italic is for emotional moments only** — title cards, the
  hero accent phrase, "Directed by you." Never for UI chrome, labels or data.
- **Micro-label + H2** is the section-heading pattern everywhere: a 10.5–11.5px
  / 0.26em uppercase `MicroLabel` over a Space Grotesk 600 heading at
  −0.02em tracking, then a `t.textSecondary` subtitle. `Shell.StudioPanelFrame`
  derives its eyebrow ("STUDIO — LIBRARY") from the route's own section in
  `lib/vater/nav-visibility.ts`, so a new nav entry gets a correct heading for
  free.
- **All billing is an ADMIT ONE ticket.** Receipts, balances, estimates and
  402 walls use `AdmitOneTicket`; at header scale, a violet-outlined ticket
  pill with a cyan tabular figure. Never a plain grey chip.
- **Film frames for video thumbs.** Any video still goes in `FilmFrame` with
  `FILM_MEDIA_STYLE` on the media (`position:absolute; inset:0` — intrinsic
  aspect ratio otherwise blows out grid tracks).
- **Every panel is glass**, except anything you have to read *through* —
  modals, dropdowns, drawers and sticky menus use the opaque `t.panel` plus a
  hairline and `shadow24`.
- **No hardcoded colour.** If a value isn't in `JELLY_TOKENS` or the active
  slice, it needs a named local constant with a comment saying which token it
  derives from (scrims, glows and the error tint are the only current
  examples).
- **Legacy Tailwind gets the `.jelly-legacy` wrapper.** Components under
  `components/vater/*` mounted inside the studio are wrapped in
  `<div className="jelly-legacy">`, which re-skins their zinc/sky/amber
  utilities. Arbitrary-value classes (`bg-[#06050a]/95`) can't be reached that
  way — see `observer/ObserverPanel.tsx` for the scoped-style pattern that
  covers them.
- **Root class names are load-bearing.** The studio shell root is
  `animate-shell jelly-cinema`; the landing is `jsl`; legal pages `jc-legal`;
  the demo `jc-demo`. `app/globals.css` keys the site-wide footer padding on
  these, and the `.jc-*` utilities are scoped under `.jelly-cinema` — anything
  rendered as a sibling of the shell root (the Help drawer) needs its own
  `jelly-cinema` class.
- **The shell root is `position: relative` with NO z-index** so it paints over
  the fixed z0 `CinemaBackdrop` without becoming a stacking context. Adding one
  would trap `BetaGate` (9999), the mobile nav drawer (210) and the Help FAB
  (80) at a single level and reorder them all.
- Light mode is not optional: the studio keeps its toggle, the choice persists
  in `localStorage['jelly.theme']`, and every value must come from `t`.

## Styling

Inline styles only. No Tailwind, no CSS modules, no new deps. All values come
from `tokens.ts` (`JELLY_TOKENS`), which has a light and a dark slice selected
by `useTheme()`. `JELLY_TOKENS.font` resolves to Space Grotesk and
`JELLY_TOKENS.fontSerif` to Instrument Serif, both loaded once by
`app/animate/layout.tsx` via `fonts.ts` — never call `next/font` yourself. See
**Cinema design language** above for the full token/primitive inventory and the
rules that govern them.

## Files

| File | Role |
| --- | --- |
| `Shell.tsx` | State owner: theme, route, editor step, toast, help drawer, tier provider |
| `Sidebar.tsx` / `Header.tsx` | Chrome. Header carries the live billing pill + Settings modal |
| `tier-context.tsx` | `useTier()` — tier + capabilities from `/api/vater/me`. Also exports `fetchVaterCapabilities()`, a context-free memoised lookup for legacy `components/vater/*` files that render outside the provider |
| `theme-context.tsx` | `useTheme()` + `useRoute()` (route state and shell-level actions) |
| `primitives.tsx` | `VBtn`, `VCard`, `VInput`, `PillStepper`, `RetryError`, `SectionHeader`, `Toast` |
| `HelpFAB.tsx` / `HelpDrawer.tsx` | Help slide-over; copy shared with the landing page via `lib/vater/help-content.ts` |
| `LatestUpdate.tsx` | Owner "what's new" banner + spend pill. Skips its fetch below owner tier |
| `ObserverSlot.tsx` / `observer/` | Right-side live Observer, owner tier only |
| `screens/dashboard/` | Style picker + style wizard (entry point of the golden path) |
| `screens/editor/` | The 7-step pipeline: Title → Script → Voiceover → Visuals → Soundtrack → Thumbnail → Description |
| `screens/editor/BillingBlock.tsx` | Shared 402 wall. `assertOk(res)` throws `BillingBlockedError`; the modal offers "Add a card" |
| `screens/studio/` | Library, Queue, Recent, Voices, Feeds |
| `screens/live/` | Publishing, Autopilot, Animation, Analytics, Discord |
| `screens/browse/` | Styles, Project History, Video Editor, Creator Models, Rules, Pricing |
| `_archive/` | Dead components kept for reference. Nothing imports them |

## Rules

- Any new fetch that can 402 must go through `assertOk()` + `BillingBlockModal`
  so the user gets an "Add a card" button, never a raw `HTTP 402`.
- A screen that a tier cannot use must not appear in its sidebar. Add the
  route to `NAV_ROUTES` with the right `minTier` rather than hiding it in the
  component.
- Do not change the locked-style render pipeline (`lib/vater/script-gate.ts`,
  `style-snapshot.ts`, `locked-style.ts`, `approve-script`,
  `billing/summary.ts`) from here.
- No placeholder copy. If a feature has no backend, do not ship a tab for it.
- Clickable elements need `role="button"`, `tabIndex={0}`, an `aria-label`, and
  an Enter/Space handler — several nav rows and toggles were bare
  `<div onClick>`. Add a `data-testid` too; the audit harness targets them.
- Navigation state comes from the hash. `Shell` listens for **both** `popstate`
  and `hashchange` — a plain `#r=…` link fires only the latter.
