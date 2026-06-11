# Vater v2 — Phase 1 Shell

This directory holds the **isolated v2 UI** for the Vater YouTube studio,
mounted at the route `/vater/youtube/v2`. Phase 1 is foundation only — sidebar,
header, dashboard, footer, help FAB, and a dark/light toggle.

## Path-isolation contract (do not break)

- All v2 source lives in **either** of:
  - `/home/jelly/tolley-site/components/vater/v2/**`
  - `/home/jelly/tolley-site/app/vater/youtube/v2/**`
- v2 must **not** import any existing `components/vater/*` file in this phase.
  When the legacy observer sidebar is wired in Phase 2 it will be imported
  from inside `ObserverSlot.tsx` only.
- v2 must **not** modify `package.json`, `next.config.ts`, `tsconfig.json`,
  any existing layout/page, or the legacy `app/vater/layout.tsx`.
- No new npm dependencies. No Tailwind. Inline styles only — match the
  prototype's pattern in `tokens.ts`.

## What's ported in Phase 1

| File                          | Source (in `/home/jelly/Shared/tubegen-ui-research/vater-design/tubegen/project/`) |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `tokens.ts`                   | `components/vater-core.jsx` (lines 4-49) + `components/vater-editor.jsx` (lines 3-8) |
| `theme-context.tsx`           | `components/vater-core.jsx` (lines 51-65)                                            |
| `Icon.tsx`                    | `components/vater-core.jsx` (lines 67-114)                                           |
| `primitives.tsx`              | `components/vater-core.jsx` (VBtn, VCard, VInput, PillStepper, SectionHeader)        |
| `Sidebar.tsx`                 | `components/vater-core.jsx` (lines 202-280)                                          |
| `Header.tsx`                  | `components/vater-core.jsx` (lines 282-380, Header + SettingsModal)                  |
| `HelpFAB.tsx`                 | `components/vater-core.jsx` (lines 382-393)                                          |
| `Footer.tsx`                  | `components/vater-core.jsx` (lines 395-421) — copyright bumped to 2026               |
| `ObserverSlot.tsx`            | New (placeholder for legacy `VaterObserverSidebar`)                                  |
| `screens/DashboardScreen.tsx` | `components/vater-screens.jsx` (lines 4-100)                                         |
| `Shell.tsx`                   | `Vater by Tolley.html` (lines 33-114, App component) — **no TweaksPanel**            |

## What's NOT yet ported (deferred)

- `components/tweaks-panel.jsx` — intentionally skipped. Will not be ported.
- `components/vater-screens.jsx` lines 102+ (NicheFinder, Styles, ProjectHistory,
  VideoEditor, LearningCenter, Pricing).
- `components/vater-editor.jsx` (the 7-step editor + per-step components).
- `components/vater-extras.jsx` and `components/vater-studio.jsx`.
- All API/data wiring — Phase 1 ships static stubs only. See the
  `// PHASE 1: shell only.` marker in `screens/DashboardScreen.tsx`.

## Modifications versus the prototype

- **SettingsModal** Security and Team tabs now contain a `next/link` to
  `/account/security` and `/account/team` respectively. Profile and Usage
  remain inline.
- **Email** in Settings is the placeholder `tvater326@gmail.com`. Real auth
  wiring lands in a later phase.
- **Footer copyright** updated to 2026.

## Phase status

- [x] Phase 1 — shell, tokens, theme/route context, dashboard stub.
- [ ] Phase 2 — wire real observer, real auth, additional screens, editor.
- [ ] Phase 3 — replace prototype data stubs with live APIs (lead/job/credit).
