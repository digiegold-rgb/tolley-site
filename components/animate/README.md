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

The Shell root carries `className="animate-shell"`, which `app/globals.css`
uses to opt this page out of the site-wide body bottom padding.

## Styling

Inline styles only. No Tailwind, no CSS modules, no new deps. All values come
from `tokens.ts` (`JELLY_TOKENS`), which has a light and a dark slice selected
by `useTheme()`. The font token resolves to `var(--font-sora)`, loaded by the
root layout. The landing page is the one exception: it has its own
`landing/landing.css` and its own fonts.

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
