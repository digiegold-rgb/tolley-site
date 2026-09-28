# Whatnot schedule → Treasure Hauls

The worker attaches Playwright to the existing signed-in Brave browser on DGX
(loopback CDP 9222), opens its own Seller Hub tab, and observes the dashboard's
`GetDashboardLivestreamsByUserId` response. It closes only its tab and disconnects.
No show controls are clicked. No passwords, cookies, raw GraphQL responses,
stream tokens, customer details or order data are saved or logged.

The pinned seller ID 72629607 was verified on September 28, 2026 against
`treasure_hauls`' public profile and authenticated Seller Hub. Browser 9223 is a
separate signed-out session; the inventory worker's `.whatnot-profile` is also
separate. Do not copy cookies between them or reuse a broadcast tab.

The complete upcoming list must have no errors, no next page, matching seller
IDs, exact millisecond timestamps and recognized fields. Incomplete/paginated,
login, challenge and network failures do not become an empty schedule. More
than 50 scheduled shows fails closed until a pagination adapter is implemented.
Private and loyalty-restricted shows are excluded. Only future public shows
are imported. Public times use America/Chicago, independent of browser locale.

Imported IDs are `whatnot_<show UUID>`. `confirmedUntil` is a six-hour source
verification lease for imported **confirmed** shows; for live shows it remains
the existing live-state expiry. The public hub, redirect, poster and campaign
publisher share this freshness check. Failed reads preserve saved records but
cannot renew the lease. A successful complete list removes missing upcoming
shows from promotion (`source_missing`); a subsequent reappearance restores them.
Owner-canceled, live and ended shows are never reactivated. Ledger/metrics stay
untouched. No schedule observation claims that a stream is live.

Show-specific previews enter the existing durable queue for explicitly bound
haul accounts; pause and rate limits still apply. Manual Stories stay manual.
Reschedules update unsent copy/times while retaining held status. Posted,
posting and uncertain sends are never replayed. Affiliate links are prepared
through the existing Impact cache; failures leave the direct show link usable.

Install the service/timer in `~/.config/systemd/user/`, reload and enable the timer.
The service uses the protected production and Impact env files via Node's env
loader. Check every four hours at :15, additionally 18:15 and 20:05 Central.
`Persistent=true` catches up after downtime. The desktop browser must be running.
If its session expires, normal Whatnot login/2FA may need renewal in that browser;
never bypass login challenges. Health is recorded as `whatnot_schedule_sync` and
shown in owner Growth. No email or chat alerts are sent by this worker.

Read-only probe:

```
node --conditions=react-server --import /home/jelly/.npm-global/lib/node_modules/tsx/dist/loader.mjs ops/stream/schedule/worker.ts --dry-run
```

Production invocation is exactly the checked-in service's ExecStart. Rollback:
disable `tolley-whatnot-schedule.timer`; imported schedule promotion expires
within six hours. Do not delete show history or restart/close the shared browser.
