# Tolley public theme — release candidate

Prepared September 9, 2026 in `feat/tagent-daily-use-20260909`, worktree
`/home/jelly/tolley-revenue-repair`. This change is implemented locally; a
successful production build, browser acceptance, push, and deployment have not
been verified. Preserve the owner's dirty `/home/jelly/tolley-site` checkout.

## What changed

The homepage, About, directory, policy pages and public service routes share
forest backgrounds, cream text, sage actions, Sora typography, header/footer,
form styling, focus rings and spacing tokens. About no longer inherits the old
purple body gradient. The directory uses a consistent card treatment. Existing
service content, local navigation, photos, forms and links remain in place.

`components/tolley/TolleyPublicFrame.tsx` applies the frame using the current
pathname, including client navigation. `lib/tolley-theme.ts` owns route coverage.
`app/tolley-theme.css` defines the design tokens and shared components.
`app/tolley-service-theme.css` adapts existing service CSS and exact color utility
classes inside the frame. Prefer semantic tokens/classes for new public UI;
extend the adapter only when maintaining an existing component. Red/green
feedback retains its meaning; old light-paper forms get contrast corrections.

## Coverage and exceptions

Core: `/`, `/about`, `/start`, `/privacy`, `/terms`, `/security`,
`/data-retention`, `/advertising`.

Service roots and their public descendants: `/wd`, `/pools`, `/homes`, `/housing`,
`/trailer`, `/generator`, `/hvac`, `/lastmile`, `/moving`, `/rental`, `/tables`,
`/picnic-table`, `/kerplunk`, `/estate`, `/cleanouts`, `/shop`, `/drive`,
`/sales`, `/real-estate-agent`. For example, pool product pages and service
privacy/terms pages inherit the frame too.

Operational path segments (`admin`, `dashboard`, `driver`, `portal`,
`analytics`, `new`, `whatsapp`) exclude those descendants. `/start/analytics`
is also excluded because core routes match exactly. Matching uses whole path
segments, so `/shopper` cannot accidentally inherit `/shop` styling.

Product apps and resources keep their identities: `/agent`, `/leads`,
`/animate`, `/gpu`, `/game`, `/food`, `/blog`, `/tools`, and other workspaces.
Partner microsites (`/biz/...`, `/junkinjays`, `/crazybins`, etc.), authentication,
payment/signature flows, and routes absent from the registry are unchanged.
New public service routes should be explicitly registered after reviewing their
product/partner ownership; do not turn the frame into a catch-all.

## Validation

Passed locally:

- Build TypeScript configuration and focused ESLint.
- `node tests/tolley-theme.mjs`: real frame rendering across public/nested paths,
  trailing slashes, product/partner/operational exceptions, preserved page
  content, one shared header/footer, skip target, and CSS parser validation.
- T-Agent tools, daily-use and guide regressions; URL cleanup regression.
- Link audit (291 pages, 873 handlers, 288 static hrefs) and changelog gate.

The link audit reports existing write-only model warnings and the directory
tests report missing display entries for `housing` and `realestateanimated`.
These warnings do not fail the checks and were not introduced by this theme.

`tests/tolley-front-doors.mjs` now checks the frame and computed base colors on
About, Start, Privacy, W/D, Pools and Sales at 390px and 1440px, captures full-page
screenshots, and checks product theme isolation after soft navigation. That
browser suite has **not run successfully** here: Chromium cannot launch under
the active sandbox (`sandbox_host_linux.cc`, Operation not permitted). No new
screenshots were visually reviewed. A final production build also remains
unverified because earlier builds could not fetch Google fonts.

## Release acceptance still needed

1. Run the full build with ordinary network/build access. Use the existing
   release process and inspect the prior security release handoff before
   releasing this branch; it also contains authentication and database changes.
2. Run `node tests/tolley-front-doors.mjs <staging-url>`. Review its desktop/mobile
   screenshots, especially W/D/Pools text and buttons, Sales required labels,
   errors and checkboxes, Start routing, and About navigation. Inspect additional
   Estate, Shop product, rental inquiry and service legal pages. Test keyboard
   focus, error states and printing the estate agreement.
3. Verify public-to-product and product-to-public soft navigation, browser back,
   and direct loads. Confirm no global body-theme residue on Animate/T-Agent.
4. Complete the security/migration and authenticated workflow checks in
   `security-release-20260909.md` and `tagent-business-tools-20260909.md`.
5. Push/deploy the tested revision and confirm it on production. The changelog
   remains the pending v1.39.0 candidate; correct its ship date when released.

GitHub access failed again with `Could not resolve host: github.com`. The local
Grok app is installed, but no supported inbound chat API/CLI was found. Its
deep links only open the app, show link information, or add plugins. The
documented Grok/Claude bridge sends **to Claude**, not to Grok, and desktop
messaging could not open a display. A handoff file does not establish delivery
or acknowledgment by Grok. Do not use an unrestricted execution daemon to
work around the current sandbox.
