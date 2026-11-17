# Laundry Rental Network

Implemented in `feat/laundry-marketplace`, isolated checkout `/home/jelly/tolley-laundry`.
Public entry: `/laundry`. Operator and owner workspace: `/laundry/dashboard`.

## Product and boundaries

National city/ZIP search uses 41,488 GeoNames postal-code centroids. Exact ZIP lists override radius matching. Approved operators appear in search; city pages and sitemap entries are derived from real approved coverage. The six curated KC pages add local guidance. No invented operators or reviews are seeded.

Wash & Dry is the disclosed affiliated KC anchor, using existing $42 washer / $58 set constants and a zero-dollar booking fee. Its initial ZIP list is a conservative subset of the existing published KC service towns and should be reviewed in the owner dashboard before launch. A radius uses ZIP centroids, not street-address geocoding.

An operator applies using their existing Tolley account, supplies prices, service area and renter terms, accepts the booking/card authorization terms and saves a Stripe card. The owner approves the listing and terms. Edits return a listing to pending approval; existing signed documents remain immutable. Only that operator and the owner can access its assigned requests. Owner access retains the existing MFA requirement; impersonated sessions cannot act.

Renters explicitly choose one operator. The signed snapshot includes that operator, equipment, monthly price, delivery fee, version, name, timestamp and document hash. No renter payment is collected. Private receipts use HMAC capabilities bound to the request ID and AUTH_SECRET. They are noindex, have a no-referrer policy, and suppress page analytics. Store links carefully; rotating AUTH_SECRET invalidates existing links.

Unsigned/uncovered interest stays unassigned. Requests expire after 24 hours without acceptance. Declines/expiry let the renter choose another eligible operator and sign again; the original signed snapshot remains in the audit event. The old operator immediately loses API access after reassignment. There is no simultaneous sale of personal details to overlapping operators. Admin routing control is through approved coverage, pause/approval, and the renter's explicit selection.

Accepting a lead is free. Confirming an agreed delivery date creates one booking fee. Repeated confirms with the same date are idempotent; rescheduling never creates another fee. Duplicate active requests for the same operator, contact, address and equipment are rejected without revealing their private receipt. A cancellation/no-show before delivery queues a refund; other disputes require owner review. Delivered renters can submit one review; negative ratings publish under the same rules as positive ratings.

The operator website upsell captures an interest flag for a separately quoted build from the existing templates. It does not sell an unspecified package or provision a separate website automatically.

## Payments

Saved cards use Stripe Setup Checkout. PaymentIntents are persisted unconfirmed before any charge is attempted. Only that stored intent can be confirmed, including after failures. The fee amount is snapshotted on the booking; no client-controlled amount reaches Stripe. Bank authentication uses Stripe.js against the existing intent. Updated setup webhooks cannot roll a saved card back to an older setup session.

The existing `/api/stripe/webhook` dispatches marketplace events only while LAUNDRY_BILLING_ENABLED=true. Alternatively, use `/api/laundry/webhook` with its own signing secret. Subscribe to checkout.session.completed, payment_intent.succeeded, payment_intent.payment_failed, payment_intent.processing, charge.refunded, and refund.updated. Configure only one endpoint for normal operation; duplicate events reconcile the current Stripe state.

An unpaid cancellation voids/cancels its intent. A cancellation racing a charge remains refund_pending until the worker reconciles it. Refunds have stable idempotency keys and persisted refund IDs. Dashboard-issued Stripe refunds are reconciled through charge.refunded, including partial refund amounts. Collected/refunded revenue is separate from requested/confirmed bookings, and anchor rental subscriptions are excluded.

## Messaging and T-Agent

A durable outbox queues renter confirmations and operator notices in the same transaction as intake/booking changes. No success is shown before the request commits. SMS consent is optional and separate from the signature. Existing global opt-outs are honored. Failed sends retry with leases/backoff and end in a visible failed state. SMTP/provider timeouts can leave an ambiguous delivery result; inspect the provider before manually retrying. This is not an exactly-once external delivery guarantee.

`/api/laundry/sms` verifies Twilio signatures and the dedicated MessagingServiceSid, handles STOP/START/HELP, rate limits each phone and records unique inbound MessageSids. T-Agent replies are grounded in the signed terms and recorded status. AI never changes a booking, promises a refund, collects a card or confirms a new delivery date. Multiple active requests on one phone are escalated instead of guessed. Operators see inbound messages and replies in the dashboard and receive an email notice. A deterministic support reply is used if AI is disabled or fails.

After-response processing attempts immediate delivery; the five-minute cron retries unfinished work and expires requests. Carrier delivery and provider availability are not guaranteed. Automatic outbound voice calls are not part of this version.

## Deployment

Do not deploy unrelated shared-checkout work or run historical pending migrations.

1. Apply only `prisma/migrations/20261116010000_laundry_marketplace/migration.sql` to the intended database, transactionally, after checking current migration state. Record it with `prisma migrate resolve --applied 20261116010000_laundry_marketplace` if applying with `db execute` rather than the standard migration runner. Tables are additive and do not rewrite existing W/D data.
2. Generate Prisma and run `node --import tsx scripts/laundry-seed.ts` against that same database. It creates the anchor only if absent; it never overwrites owner edits. No historical customer data is imported and no messages are queued by the seed.
3. Deploy the application with billing/messaging switches off until provider configuration is verified. Required existing foundations: DATABASE_URL, AUTH_SECRET, working Tolley account login and owner MFA. APP_URL and LAUNDRY_PUBLIC_ORIGIN should be trusted HTTPS origins. LAUNDRY_PUBLIC_ORIGIN defaults to https://www.tolley.io; the application remains under `/laundry` on the configured origin.
4. Configure Stripe keys, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, verified webhook events and set LAUNDRY_BILLING_ENABLED=true. A separate webhook uses LAUNDRY_STRIPE_WEBHOOK_SECRET; the shared existing handler uses STRIPE_WEBHOOK_SECRET.
5. Configure EMAIL_SERVER_* and LAUNDRY_EMAIL_FROM (or existing EMAIL_FROM); a brand-appropriate Twilio messaging service using LAUNDRY_MESSAGING_SERVICE_SID; set its inbound webhook to the exact LAUNDRY_PUBLIC_ORIGIN/api/laundry/sms URL. Confirm campaign registration and opt-in language for this marketplace. Set LAUNDRY_NOTIFICATIONS_ENABLED=true only after controlled delivery tests. LAUNDRY_AI_ENABLED=true enables existing LLM routing for inbound replies. Existing TWILIO_AUTH_TOKEN authenticates callbacks.
6. Configure CRON_SECRET and verify the Vercel five-minute `/api/cron/laundry` schedule. Run a controlled non-anchor booking, declined-card recovery, bank authentication, cancellation/refund and SMS opt-out before inviting external operators.
7. Review legal text, real public mailing address, operator authority and actual ZIP coverage before public launch. No invented street address is published; the current footer identifies Your KC Homes LLC, KC region, email and phone. Draft marketplace legal pages are implemented, but have not been reviewed by counsel.

No domain has been registered and no production provider configuration is changed by this branch. A separate domain can use the same app and canonical-origin setting after acquisition and DNS setup; root-path domain routing is not configured here.

Rollback: deploy the preceding application; disable the laundry cron and feature switches. Retain new tables, signed records and billing evidence. Reconcile pending charges/refunds before disabling their worker.

## Validation

Only the disposable PostgreSQL database at 127.0.0.1:55465/tolley_laundry_test and local app at 127.0.0.1:3065 are used for mutation tests. Tests use synthetic accounts and stub Stripe; they do not charge cards, send SMS/email, register domains or contact operators.

- `node --import tsx tests/laundry/integration.ts`: service coverage, intake validation/deduplication, operator isolation, signed snapshots, booking idempotency, zero-fee anchor, refunds, expiry, reassignment, reviews and notifications.
- `node --import tsx tests/laundry/access.ts`: HTTP authorization using real test JWTs/MFA, onboarding/approval, cross-operator reads/writes, CSRF, disabled billing and unsigned callback rejection. Local app needs ADMIN_ALLOWLIST_EMAILS=laundry-admin@example.invalid and the test AUTH_SECRET.
- `node tests/laundry/browser.mjs`: desktop/mobile layout, ZIP search, profile, signed request, receipt/download, bad-token denial and uncovered-area behavior.
- `node --import tsx --test tests/discovery.test.ts`, TypeScript, route inventory, link audit and production build.
- Additive migration applied to a prior-schema disposable database and compared to the intended schema.
- Discovery HTTP health checks against the local production build.

Launch acceptance involving real Stripe/SMS/email and counsel review remains separate from these code tests.
