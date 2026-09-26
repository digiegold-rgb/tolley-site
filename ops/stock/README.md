# Tolley Stock

Owner page `/stream/stock`; `/stock` redirects there. APIs require the existing owner session/MFA, except `/api/stock/worker/*`, which require a separate scoped bearer secret. Nothing bids, pays, publishes a product, or controls a stream.

## Email intake

Production inspection found **Google Workspace SMTP**, not SendGrid. Existing Workspace credentials also support IMAP. Avoid a new provider, new MX records, and mail routing changes: forward chosen alerts to `jared+stock@yourkchomes.com`. The 15-minute worker reads messages to this address and messages from B-Stock, Equip-Bid, Cargo Largo, and Direct Liquidation already delivered to INBOX. It selects the mailbox read-only and uses BODY.PEEK, so read/unread state stays unchanged. Mail in other folders is not collected.

The four existing B-Stock searches (WN Health Beauty, WN Apparel Jerseys, WN Small Electronics, WN Toys Fidget) had email enabled on 2026-09-26. Verification/password emails are excluded. B-Stock tracking redirects are resolved only across its explicit hostname allowlist. Messages without recognized direct lot links appear for owner review, not as fabricated listings. CSV/XLSX manifests require a matching listing URL. Manifests remain estimates until receiving is finalized.

## Deploy

1. Install dependencies; generate Prisma client. Run `scripts/apply-stock.ts` with `DATABASE_URL` for a dry run, then `--apply` after verifying the target. The migration creates four tables in a transaction and never changes existing inventory. Do not run the repository's complete historic migration chain against production.
2. With the existing SMTP environment loaded, run `node ops/stock/configure.mjs --vercel` from this linked Vercel project. It writes a mode-0600 worker file under `~/.config/tolley-stock`, preserving the token on repeat runs. It adds the token and intake address to Vercel without printing credentials. If variables already exist, reconcile them rather than rotating blindly.
3. Build and deploy the web app. Run the mail worker once with its environment loaded, verify one intake end to end, then install the four service/timer files in `~/.config/systemd/user`. Enable `tolley-stock-mail.timer` and `tolley-stock-browser.timer` with `systemctl --user enable --now`.
4. Services expect the release at `~/tolley-stock`. They run under separate `flock` locks. Browser uses the existing authenticated Chromium CDP endpoint; it creates and closes only its own tab. Refreshes at most 10 watched B-Stock lots hourly. The browser never logs in, bids, retries an OTP, or bypasses a challenge. Every click/navigation goes through a minimum 3.1-second gate. Missing sessions/challenges show reconnect/error in the dashboard.

## Accounting and operating limits

- SourceLot, Product, ShopSale and StreamLineup remain the shared ledger. StockPurchase adds receipt state and links a watched opportunity to an existing source lot.
- Record the actual total paid. The $500 trial budget is guidance, not a restriction that prevents truthful bookkeeping.
- Partial receipt counts are cumulative. Finalize once after inspection; at most 500 sellable units per trial lot. Costs split across all received units, including damage, using integer cents. Missing units receive no allocation. Optional per-row allocations must sum exactly to total purchase cost. Finalized receipts cannot be rewritten.
- Record one sale per physical product. Transaction locks prevent repeated clicks from duplicating purchases, receipts, or sales. Different amounts on a retry are rejected. Imported sales from other shop workflows are read from the same ShopSale rows; incomplete cost data produces unknown profit.
- Whole-lot cash recovery is net cash from sales minus the entire acquisition cost. Sold-unit profit deducts only sold COGS. Damaged write-offs are displayed separately; they are already included in the acquisition cost and must not be subtracted twice.
- Listing data is an observation, not a quote. Unknown fees/freight never become zero. Browser refresh uses the next required bid where available, preserves owner notes and shipping assumptions, and clears estimated fees when the evaluated bid changes. Historical and ended deals are hidden by default. Imports are capped at 2 MB / 1,000 manifest rows. Dashboard returns the newest 500 deals.

## Validation

`tests/stock/core.test.ts`, `tests/stock/browser.test.mjs`, and `tests/stock/integration.mjs` cover pricing, manifest validation, allocation, expired listings, browser pacing, MFA, origin checks, idempotency, receiving, lineup integration, shared sales, and desktop/mobile rendering. Integration tests require the disposable `tolley_stock_test` database at localhost:55449 and app at localhost:3059. Never run fixture writers against production.

## Operations / rollback

Read `systemctl --user status tolley-stock-mail.timer tolley-stock-browser.timer` and `journalctl --user -u tolley-stock-mail -u tolley-stock-browser`. Import failures and stale collection timestamps are visible under Imports & sources. Failed imports can be reviewed and retried. Credentials stay outside the repo; do not log HTTP Authorization headers, passwords, or browser cookies.

To pause collection, disable the two timers. Revert the web release if needed; retain the additive tables and existing purchased inventory. Do not delete stock tables as part of rollback.
