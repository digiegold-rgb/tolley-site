# URL cleanup — September 9, 2026

Implemented locally on `fix/url-cleanup-20260909` in `/home/jelly/tolley-revenue-repair`.
This branch starts at `60477ff` and includes the unreleased security changes. It has not been deployed. Release version 1.38.2 is staged; its date is not evidence of a production deployment.

The user explicitly preserved `/gpu` and `/game`. Their source files, existing public discovery eligibility, and sitemap eligibility are unchanged. No production data, credits, customer projects, partner business pages, or APIs were deleted.

## Changes

| Route | Behavior after deployment |
| --- | --- |
| `/m/wd` | Temporary redirect to `/wd`, keeping the Messenger attribution defaults. |
| `/circle` | Permanent redirect to `/start`; service selection, optional contact intake, and email signup moved first. Existing Circle action/source identifiers remain valid. |
| `/clean` | Permanent redirect to `/cleanouts`; moving, vehicle/equipment transport, and $3/loaded-mile delivery descriptions and intake guidance added to the destination. |
| `/real-estate-agent` | Temporary redirect to `/homes` only when no neighborhoods are published. Published neighborhood routes and the populated index remain usable. |
| `/shop/videos` | Temporary redirect to `/shop` while there are no videos. Navigation and sitemap automatically restore the section when eligible videos exist. Empty URLs do not count as videos. |
| `/leads/connects` | Temporary redirect to the working dashboard/CSV import. Removed the misleading integration and MLS launcher descriptions. |
| `/leads/dossier/property/[address]` | Permanent redirect to `/agent#demo`. Chat links explicitly say “View product demo.” Real dossiers by ID remain untouched. |
| `/video`, `/video/studio` | Anonymous visitors temporarily enter `/animate`; signed-in customers retain their existing workspace and credit code. The Animate footer has explicit legacy sign-in links. |
| `/vater`, `/vater/dropship`, `/vater/merch`, `/vater/govbids` | Require an owner/admin session and have noindex metadata. HQ links to the hub. |
| `/vater/courses/**` | Public waitlists retained, with a development notice and noindex metadata. Their footer no longer promotes owner-only tools. |
| `/water`, `/persona` | Require an owner/admin session before rendering. Water's existing API/PIN workflow remains intact. HQ links remain available. |
| `/advertising` | Retained as a factual, noindex integration-information URL. Removed outdated plans and claims about available advertising capabilities. |

Public directory/cross-sell promotion excludes the owner tools, legacy video entry, advertising, private agents/scan features, and empty neighborhood entry. The operational manifests remain registered. Kerplunk now describes the yard game, Drive describes driver opportunities, and generator/trailer labels match their offers. Public links point directly to consolidated pages. Customer billing, editors, actual property dossiers, partner businesses, and operational endpoints remain available.

## Validation

- `node tests/url-cleanup.mjs`: passed. Executes actual route modules with isolated authentication/database fixtures. Checks temporary/permanent redirect behavior and repeated query parameters; empty and populated pages/sitemap; anonymous, customer, and owner access; course waitlists; legacy credit balance/tier preservation; shop tabs; migrated intake; and retained public products. This is not a browser or production database test.
- `node scripts/audit-links.mjs`: passed (273 pages, 870 handlers). Existing write-only-model warnings remain.
- `node scripts/check-changelog.mjs`: passed for the staged 1.38.2 entry.
- Final TypeScript check passed (exit 0). Focused ESLint passed with zero errors and warnings, including new source/test files. Logs: `/tmp/tolley-url-cleanup-types.log`, `/tmp/tolley-url-cleanup-lint.log`, and `/tmp/tolley-url-cleanup-tests.log`.
- `git diff --check` and a comparison of `app/gpu` and `app/game` against `60477ff`: passed.
- Production build attempted with the repository's Next build launcher. It failed with `Could not parse output from TypeScript's --showConfig` / `Unexpected end of JSON input`. Direct TypeScript `--showConfig` produced valid output; the Next subprocess failure remains unresolved. Log: `/tmp/tolley-url-cleanup-build.log`.
- GitHub access failed: `Could not resolve host: github.com`. No push, PR, or deployment succeeded.

## Release requirements

1. Resolve the Next build failure and obtain a successful complete build. Do not treat the passing TypeScript or isolated route tests as a successful production build.
2. Complete the prerequisite security release checks in `security-release-20260909.md`, including its database migration, restoration verification, and authenticated HTTP/browser checks. Alternatively, deliberately separate and validate the cleanup patch against the current production branch before release.
3. In staging, verify actual HTTP status/Location for redirects with campaign parameters, owner/customer access, mobile `/start` intake and email capture using test delivery, and legacy sign-in/project/credit continuity. Verify `/gpu` and `/game` remain accessible.
4. Push/review/deploy after required checks pass; then verify the live redirects, public directory, and sitemap. This worktree alone does not update tolley.io.

Rollback is a revert of the URL cleanup commit. There is no cleanup database migration or deleted customer data to restore. Older marketing content remains in Git history.
