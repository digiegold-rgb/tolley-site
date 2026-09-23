# Shared inventory and nightly shows

The owner desk is `/stream/inventory`. It uses the existing owner login and MFA. Product IDs are the stable identity; the Shopify SKU is `tolley-<Product.id>`. Never merge products merely because their titles match.

## Daily operation

1. Count physical stock in the desk. The migration preserves sold products at zero and initializes other products at one **unverified** unit. A lineup quantity is a plan, not evidence of how much stock exists.
2. Record a Marketplace/cash sale in the desk, or use Hold for buyer, then Complete sale. A hold makes units unavailable to shop checkout. Check the Marketplace listing-update tasks: personal Marketplace conversations are not an order API.
3. Before the 8:30 p.m. America/Chicago show, select the lineup and Reserve show stock. This reserves every remaining lineup unit atomically; an insufficient item rejects the entire operation. This action never starts or stops a stream. Reservations are explicit, not a time-based guess about which lineup is tonight's.
4. With CSV/manual Whatnot, Sell one unit in the clicker updates the common stock and sale ledger. Replays of the same request do not deduct twice. The clicker refreshes every five seconds. With a linked Shopify product, use Whatnot's connected listing; inventory arrives automatically and manual Whatnot deductions are rejected to avoid counting the same sale twice.
5. Release unsold show stock after the show. Inspect pending external-listing updates and sync exceptions. Returning stock is a separate recorded correction; it does not refund money.

The shop checkout reserves a unit before creating its Stripe session. Only a verified completion consumes it; a verified expiration releases it. Sessions last 30 minutes. The cron checks old known sessions as a fallback. Uncertain session creation keeps stock held and opens a review issue. Never release such a hold based on elapsed time alone.

## Shopify activation (not performed by this change)

The paid Shopify account and Whatnot channel must be activated separately. Existing Whatnot CSV listings must be replaced or removed after their connected equivalents are verified; otherwise duplicate offers remain independent.

Configure server-only environment variables:

- `SHOPIFY_SHOP_DOMAIN`: the exact `example.myshopify.com` domain.
- `SHOPIFY_ADMIN_ACCESS_TOKEN`: an authorized store app token with `read_products`, `write_products`, `read_inventory`, `write_inventory`, and location access as required by Shopify.
- `SHOPIFY_LOCATION_ID`: the single stock location, `gid://shopify/Location/...`.
- `SHOPIFY_WEBHOOK_SECRET`: the app's webhook signing secret.
- Existing `CRON_SECRET`, Stripe credentials, and `STRIPE_WEBHOOK_SECRET` must remain configured.

Subscribe Shopify `inventory_levels/update` to `/api/webhooks/shopify-inventory`. Subscribe Stripe `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.expired` to the existing Stripe webhook.

The desk can create a dedicated one-variant Shopify draft with title, escaped description, price, package weight, initial inventory, and up to eight images. Review category, condition, shipping, images, and the Whatnot-specific prices in Shopify before publishing to the Whatnot channel. Existing product updates preserve live stock and publication status; initial images are copied only on creation. Change existing images in Shopify. Tolley title/description/price/weight/brand edits through the product endpoint also update linked products. Other bulk/worker changes must use Update product details until they adopt the same publishing path.

To link a preexisting variant, set its SKU to `tolley-<Product.id>`, count physical stock, match Shopify's quantity, and enter the inventory-item/location IDs. Linking rejects mismatched stock, unverified counts, active holds, and wrong SKUs. One product maps to one inventory item at one location.

The connector uses Admin GraphQL `2026-07`. Local changes enqueue durable stock deltas. A worker reads current remote stock, accounts for intervening remote changes, and applies compare-and-swap updates with a persisted idempotency key and immutable parameters. Lost responses retry the same request. Rejected comparisons and requests older than 23 hours stop for review. To resume a paused product, resolve its reservations, inspect Shopify orders/adjustments, save a fresh physical count in the desk, correct Shopify to the same physical quantity, then use Verify matching counts and resume. This verifies the live SKU and count, records the reconciliation, and supersedes old pending deltas without writing over Shopify. A request still in flight must finish or reach the review window first; a count alone never reopens paused sales. The cron processes the oldest checked mappings every minute, with signed webhooks and local actions providing quicker updates. Failed updates remain visible. This is eventual synchronization, not a distributed atomic checkout across platforms.

Whatnot show holds keep units available to the Whatnot Shopify channel while removing them from Tolley's checkout. Other buyer holds reduce the connected remote availability. Personal Marketplace listings still require confirmation. Avoid selling the same unique item in overlapping auctions or an unconnected storefront. Other Shopify sales channels share Shopify availability and need their own allocation strategy if they must be paused during a show.

Inventory updates are stock observations, not confirmed order/payment events: they do not fabricate Whatnot revenue, buyer information, or refunds. Decreases consume show allocations, but price and order reconciliation remain in Whatnot/Shopify. Check exceptions if a remote adjustment conflicts with another buyer's hold.

## Deployment

1. Apply `prisma/migrations/20260922_shared_inventory/migration.sql` before deploying this code. It is additive and preserves old sold state. It enforces nonnegative, balanced stock and valid reservation quantities.
2. Generate Prisma client, deploy application, enable `/api/cron/shop/inventory`, and verify the Stripe event subscriptions above.
3. Sign in as owner, verify a small set of physical counts, then test one checkout, one Facebook sale, and a show reservation/release.
4. Activate Shopify only after the store, credentials, subscriptions, IDs, and initial counts have been verified. Perform a low-value live Whatnot test to measure actual propagation and verify the shop stops accepting the last unit.

Rollback application and schema together: old sold handlers bypass this ledger. Keep stock-changing actions paused during rollback. The journal should be retained, not dropped.

## Validation

Use only the isolated local database on port 55449:

```
DATABASE_URL=postgresql://postgres@127.0.0.1:55449/tolley_inventory_test node --import /home/jelly/.npm-global/lib/node_modules/tsx/dist/loader.mjs tests/shared-inventory.ts
```

`tests/shared-inventory-browser.ts` exercises the desk, owner MFA, unauthorized requests, mobile overflow, signed Stripe completion replay, and expiration through a local server on port 3027. It creates only local test records and never calls a live payment account. Shopify network behavior is mocked in the database suite; a real store acceptance test remains required at activation.

References: [Whatnot integration](https://help.whatnot.com/hc/en-us/articles/44650692889997-Shopify-x-Whatnot-Integration), [Shopify inventory CAS and idempotency](https://shopify.dev/docs/api/admin-graphql/latest/mutations/inventorySetQuantities), [productSet](https://shopify.dev/docs/api/admin-graphql/latest/mutations/productSet).
