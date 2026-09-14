# Listing Studio self-service sales

The product is already at `/realestateanimated`; Vater supplies the production engine.
This release improves that existing offer. It does not introduce new prices or subscriptions.

## Offer and conversion path

- Entry product: $4.99 virtual staging photo, eligible for the existing $10 still-image starter grant.
- Paid upgrades: $14 beauty shot and $19 economy / $29 photoreal before-and-after video. Video requires purchased credit.
- Start button → email-locked signup link sent automatically → account → photo → price confirmation → generation → download.
- Listing requests from direct, search, referral, and paid traffic use the same automatic invitation path. Existing email binding, signup validation, IP rate limits, honeypot, credit checks, and render limits still apply.
- Mail failures leave the request for support and show a pending message, never a false “link sent” confirmation.
- The $99 launch bundle is removed from the landing because it includes the unavailable walkthrough SKU.
- Help opens instructions and the existing ticket form. Tickets identify Listing Studio instead of defaulting to Jelly.

## Acquisition and measurement

Existing root analytics record page visits and campaign attribution. Landing CTAs record `listing_start`; form outcomes record `listing_signup_link_sent`, `listing_signup_pending`, or `listing_signup_error`. No email addresses are sent in these events.

Public disclosure pages now link back to signup with the `proof / referral / listing_self_service` campaign. This gives already-shared customer proof pages a path to new signups. It is not a promise of traffic or conversions.

Invite rows marked `won` mean access delivered, not revenue. Count paid credit purchases from confirmed billing records, then completed paid listing jobs and repeat purchases. Do not treat grants or failed/refunded jobs as sales.

First target: 10 purchases completed without sales calls. Evaluate render cost, refunds, repeat purchases, and support time before increasing traffic. No ad spend, outbound campaign, marketing-email sequence, or posting schedule is activated by this code change.

## Remaining launch verification

The existing authenticated render/payment flow is not replaced here. Before claiming it is ready for unattended selling, verify a fresh email signup, credit purchase, staging, video delivery, refund behavior, and ticket submission against the deployed version. Browser checks of the landing mock mail delivery and do not establish that a real inbox received a link.

The configured backend answered its health endpoint and existing records include completed staging and video jobs. Historical successes are not an end-to-end test of this release or evidence of demand.
