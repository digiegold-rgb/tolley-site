# T-Agent owner routing repair

The pricing navigation always rendered Sign in and returned an authenticated
visitor to pricing. Pricing did not distinguish owner access or incomplete MFA.
Separately, the global Studio workspace cookie replaced the main user ID on
T-Agent pages and APIs, causing subscription and CRM queries to use a hidden
Studio user instead of the real login.

The production account reported by the owner was verified read-only: it has
credentials, verified MFA enrollment, active onboarded Team access, and owner
allowlist membership. No account or billing mutation is needed to repair it.

## Behavior

- Verified owners visiting pricing open `/leads`, which already supports included
  owner workspace activation when a subscriber row does not exist.
- Pricing navigation sends signed-out visitors to login with `/leads` as the
  destination, signed-in customers to their workspace, and incomplete MFA to
  verification. Customers can still view their plans.
- Owner subscription requests return the workspace URL before Stripe access.
  Incomplete MFA and read-only support impersonation cannot create checkout.
- Proxy overwrites `x-tolley-pathname` with the actual request path. Authentication
  keeps the primary user ID on `/leads` and `/api/leads`, including descendants.
  Studio tab behavior and subsequent support impersonation remain intact.
- Credentials login reloads its validated relative destination on the current
  host, re-reading session/MFA state. Network errors release the submit button.
  Both login callback validators reject backslashes and line breaks.

## Verification

`tests/leads-owner-routing.mjs` exercises the actual auth callback, proxy,
pricing page/layout and checkout route with isolated dependencies: owner and
customer behavior, incomplete MFA, support impersonation, Studio tab isolation,
customer checkout preservation, and forged path-header replacement.

`tests/leads-owner-routing-browser.mjs` uses disposable PostgreSQL accounts,
real credentials and MFA endpoints, and Chromium. It verifies the pricing link,
network-error recovery, sign-in to MFA, verified-owner redirect to Today, the
primary subscription with a signed Studio tab cookie, owner checkout bypass,
legacy pricing callback, and unpaid-customer denial. Third-party requests are
blocked. Next normalizes loopback origins to localhost, so browser tests use
localhost while the isolation guard requires the existing loopback test database.
All fixture users and workspaces are removed afterward.

Both suites, the existing T-Agent owner-guide suite, focused ESLint, TypeScript,
changelog validation, and link auditing passed. Full build and live release
verification are recorded in the pull request. These tests do not use the
owner's production credentials or bypass production MFA.
