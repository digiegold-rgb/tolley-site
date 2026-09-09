# Tolley security repair: release status and remaining work

Prepared September 9, 2026, in `fix/security-efficiency-20260909`.

**This is an unreleased patch. Production migration, deployment, service
restoration and browser acceptance are not complete.** The existing production
landing page and `/agent` move were released separately in v1.38.0. This patch
targets v1.38.1; confirm the changelog date when it actually ships.

## Implemented in this branch

- Patched Next.js and affected dependencies, including the mail and merge
  packages. The installation audit reported zero known vulnerabilities.
- Added customer-owned lead workflow state. Notes, status, contact dates,
  referral fields and pipeline state no longer overwrite shared source leads
  through the updated customer endpoints. Manual FSBO creation now works and
  assigns an owner. Legacy unassigned manual leads remain operator-only.
- Scoped the lead dashboard, pipeline, people, FSBO, analytics, copilot and
  smart-list queries. Smart-list tags and activity/task counts are scoped to the
  subscriber. CRM reference validation rejects foreign contacts and deals.
- Restricted edits and re-runs of shared dossier records to operators; removed
  private lead fields from nested dossier responses. Fixed absent-secret
  comparisons in dossier pages so missing configuration cannot authorize access.
- Enforced MFA during session authorization for enrolled users and required
  enrollment for owner accounts. Proofs bind to the login session and enrollment,
  expire after 12 hours, and use HttpOnly cookies. Setup/verification require a
  fresh primary sign-in, matching Origin and rate limits. Recovery codes are
  consumed atomically and recently used TOTP codes cannot be replayed.
- Removed HQ and W/D PIN-cookie authorization. Those screens now require an
  authorized account with MFA. Corrected ignored admin guard results in the
  trading-agent API and blocked lead writes during support impersonation.
- Consolidated pageviews into the root tracker. Subsite layout mounts no longer
  create duplicate views. Deferred the Animate editor for anonymous visitors.
- Enabled CSP by default, removed production `unsafe-eval`, preserved the
  same-origin rules PDF exception, and disabled the framework identification
  header. `CSP_ENFORCE=0` explicitly restores report-only mode after a rebuild.
- Added an encrypted offsite backup script and optional systemd unit/timer
  templates. The timer is **not installed or enabled**.

## Verification and limits

The database isolation/proof/compatibility regression was run successfully on
the disposable database. It verifies separate customer notes and statuses,
manual-lead visibility, rejected source-field writes, scoped counts, proof
binding/expiry/tampering, route classification, local mail transport and merge
compatibility. Later additions also cover rejected CRM references and unsupported
delegate operations. See the final local handoff for the latest build/lint result.

HTTP tests are prepared in `tests/security-http.mjs`. Existing posts/revenue
regressions now use a real credentials + CSRF + MFA fixture flow in
`tests/helpers/owner-session.mjs`. The front-door browser test additionally checks
single pageviews for W/D and Animate and enforced CSP violations. These modified
HTTP/browser regressions have **not passed yet**: starting a local listener and
new database/Docker commands were denied under the current sandbox.

The earlier build passed before the final review edits; a final build is required.
Do not substitute a type check or signed-token unit test for the real sign-in,
owner enrollment, checkout and browser checks.

This is not a certification of tenant isolation throughout the entire repository.
Dossiers remain shared research data; private per-customer dossier annotations
would need their own ownership model. The scoped lead delegate supports the
operations used by this patch, not the entire Prisma API. Sorting by source
columns such as `updatedAt`, `contactedAt` or `ownerName` still uses source-row
ordering before private values are overlaid; customer-specific sorting and a
database-level status aggregation need a follow-up before large-scale use.
Legacy global notes are preserved for operators; there is no reliable owner
mapping to migrate them automatically into customer accounts.

CSP still permits inline scripts and broad HTTPS/WSS connections. Full nonce-based
CSP would require a separate rendering and third-party integration review.

## Backup already created

- Snapshot: `2026-09-09T02-41-50-244Z-7dfbd538`.
- Local: `/home/jelly/.local/state/tolley-security/2026-09-09T02-41-50-244Z-7dfbd538`.
- Encrypted remote: `gcs-crypt:tolley-backups/2026-09-09T02-41-50-244Z-7dfbd538`.
- Database dump: 701,789,453 bytes, PostgreSQL custom format, production server 17.
- Upload completed; `latest.json` records the result. Scope: database and Spark
  service/tunnel/app configuration. Generated media is excluded.
- Remote download verification and actual restore are **not complete**. The
  empty `tolley-security-restore` PostgreSQL 17 container has no published ports
  and no network. The restore command was denied by Docker socket permissions.
- Preserve a separate recovery copy of the rclone crypt configuration/keys; a
  copy inside its own encrypted backup cannot bootstrap disaster recovery.

## Release sequence once normal service/test access is available

1. Finish the offline restore, without exposing a production data clone:

   ```sh
   docker exec tolley-security-restore pg_restore --username postgres --dbname tolley_restore --exit-on-error --no-owner --no-acl /backup/database.dump
   ```

   Verify schema and representative table counts, then download a remote copy
   and compare checksums. Never point this command at the production database.

2. Run the isolated app with these fixture settings and no production secrets:

   ```sh
   DATABASE_URL=postgresql://postgres@127.0.0.1:55438/tolley_revenue_test AUTH_SECRET=security-test-secret-only AUTH_URL=http://127.0.0.1:3018 APP_URL=http://127.0.0.1:3018 ADMIN_ALLOWLIST_EMAILS=security-admin@example.invalid SYNC_SECRET=posts-test-sync-only node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3018
   ```

   Run tests serially against that app: `security-http.mjs`, `posts-accuracy.mjs`,
   `revenue-repair.mjs`, and `tolley-front-doors.mjs`. Supply the same disposable
   `DATABASE_URL` and `REVENUE_TEST_URL=http://127.0.0.1:3018`. Resolve all failures.
   For the isolated TypeScript regression:

   ```sh
   DATABASE_URL=postgresql://postgres@127.0.0.1:55438/tolley_revenue_test AUTH_SECRET=security-test-secret-only node --conditions=react-server --import /home/jelly/.npm-global/lib/node_modules/tsx/dist/loader.mjs tests/security-isolation.ts
   ```

3. Check the real owner email allowlists and DB owner grants without logging
   their values. Verify the complete enrollment/recovery flow in staging. Every
   existing session must sign in again because old JWTs lack the new session
   binding. The owner must personally scan the authenticator QR and retain the
   recovery codes after deployment; never enroll a device on their behalf.

4. Inspect production migration history and schema. Apply the additive
   `prisma/migrations/20260909030000_customer_lead_state/migration.sql` before the
   new application reads it, and record migration state using the repository's
   existing production procedure. Do not blindly apply unrelated pending
   migrations. This patch has not migrated production.

5. Release the verified build, then smoke-test `/`, `/agent`, `/leads/pricing`,
   `/animate`, `/wd`, account login/MFA, `/hq?tab=posts`, customer A/B isolation and
   a Stripe test checkout. Confirm one correctly classified view per navigation,
   no enforced CSP errors, and owner-only shared dossier edits. Do not send real
   customer messages or perform a live payment during a smoke test.

6. Retain the backup and migration on rollback. Rolling back the application to
   v1.38.0 reintroduces the old authentication/customer workflow weaknesses; do
   not treat that as a security-equivalent fallback.

7. After restore verification, install the backup script at
   `/home/jelly/.local/lib/tolley/security-backup.mjs` and unit/timer templates into
   the user systemd directory. Validate environment access and a manual run,
   then enable the timer. Establish retention and failed-backup alerting first;
   daily full dumps otherwise consume unbounded local and remote storage.

## Spark and subdomain repairs still outstanding

The audit observed the statuses below. They have not been repaired or reverified
by this branch, and are not claims about their present external availability.

| Service | Observed issue | Required repair |
| --- | --- | --- |
| `manus.tolley.io` | 502; service inactive | Make missing-token authentication fail closed, restrict CORS, configure secret, start and health-check. |
| `chat-bridge.tolley.io` | 502; service inactive | Remove token logging, configure a stable token matching the app, bound request bodies, start and check health without sending messages. |
| `action-api.tolley.io` | 502; service inactive | Verify the existing fail-closed token configuration, start only the API, confirm loopback binding and health. |
| `media.tolley.io` | 530; worker active | Repair tunnel/DNS, rotate the hardcoded fallback secret on both app and worker, remove fallback, restrict binding, test an authorized media operation. |
| `upload.tolley.io` | 502; backend not identified | Locate or provision the intended upload service with authenticated, bounded uploads and storage quotas; connect existing `/files` clients. |
| `postiz.tolley.io` | 502 | Review the compose stack, dependencies, secrets and publish queues before starting; verify health without publishing. |
| `tradingagents.tolley.io` | 502; intended port 8955 API not identified | Identify the HTTP backend; the discovered interactive trading container is not that service. Do not start trading jobs as a test. |
| `engine.tolley.io` | 502; service inactive | Review Redis/gateway connections and disable scheduler side effects during verification before restoring the API. |
| `hermes.tolley.io` | 502; service inactive | Restore the authenticated API without automatically enabling Telegram/Discord gateway activity or unrelated agent tools. |

The tunnel is `94a55433-5cd7-4800-8f5c-b943e3d430bb`, configured at
`/home/jelly/.cloudflared/config-research.yml`. Bind local services to loopback
where Cloudflare is their sole caller. Review firewall rules and required LAN
access before changing SSH, SMB, FTP, GPU or media-server exposure; a listener on
`0.0.0.0` alone does not establish internet reachability.

## Working state / cleanup

- Keep the owner's dirty `/home/jelly/tolley-site` checkout intact.
- Current work is isolated in `/home/jelly/tolley-revenue-repair`.
- Task-created containers: `tolley-security-test` (localhost port 55438) and
  `tolley-security-restore` (no network/ports). Remove them after required checks.
- Backup environment is private at
  `/home/jelly/.config/tolley-security/production.env`; never commit or print it.
- The sandbox is `workspace-write` with approval policy `never`. It cannot grant
  itself sudo or approve blocked socket/network/listener operations. Authentication
  and financial paths should remain unreleased until the missing checks pass.
