# Whatnot affiliate integration

Verified September 27, 2026 through the authenticated Impact Partner API: Whatnot Affiliates program 23513 is Active, deep linking is enabled, and Tolley.io property 8918206 is ownership verified. The provided publisher tag belongs to publisher 7857130. Credentials are server-only Vercel variables `IMPACT_ACCOUNT_SID` and `IMPACT_AUTH_TOKEN`; never copy their values into source, URLs, logs, or public content.

## Links and publication

Impact generates links through its TrackingLinks endpoint. Cache the returned URL unchanged in AffiliateLink (`impact-whatnot`), keyed by the exact destination. Only approved Whatnot profile/show destinations are eligible; buyer invite paths are rejected. Confirming a future show prepares its link after the owner request. Growth's sync also prepares missing links. Until a link is ready, clicks go directly to the correct show/profile.

Scheduled-show buttons go through `/go/show` only after an intentional click from `/live`. The disclosed profile button renders the unchanged affiliate URL directly so the publisher tag can observe its impressions; a keepalive request separately records its local affiliate click. Requests coming straight from social platforms, missing referrers, and crawlers retain direct Whatnot destinations, avoiding an affiliate hop that obscures the original source. New social reminders use the real hub, with an affiliate disclosure. Existing buyer invitation `/go/whatnot` remains the original referral URL and is never wrapped in Impact. The active contract specifically excludes invite URLs from affiliate payouts.

The publisher snippet runs on `/live` after explicit optional measurement consent. It sends the supplied `trackImpression` call; no customer identity is passed. Navigation away from the opted-in hub starts a new document. Turning measurement off reloads the hub without the tag. Browser DNT/GPC preferences suppress stored consent. The exact Impact CDN is allowed by the existing script policy. Affiliate click links still function independently of optional page measurement.

## Reporting

The campaign heartbeat attempts a sync once daily. Owners can sync from Growth. Import a complete rolling 30-day action window, following same-account pagination. Impact date filters require timestamps without fractional seconds. Deduplicate by action ID; group pending/approved/reversed commissions separately by currency. Store only aggregate snapshots, never customer/order details. Failed fetches preserve the last snapshot; its timestamp is visible. Cash received is unknown and is not inferred from approved commission.

Local source-level outbound clicks and Impact-attributed commissions are distinct measures. The generated links use `subId1=tolley_live` and a profile/show identifier in `subId2`; no per-person tracking values are sent. Commission snapshots are separate from the seven-day show ledger export and explicitly labeled as a rolling 30-day period. Never add Impact order values into merchandise sales.

## Promotion limits from the active program contract

- Organic promotion on owned social pages is permitted, with clear disclosure before affiliate endorsements. Video affiliate endorsements need disclosure in the video medium too.
- Do not bid on Whatnot trademarks, put Whatnot in paid-ad copy, or send PPC traffic straight to affiliate destinations. Paid ads should promote Treasure Hauls and land on the real hub. The existing organic Whatnot-name copy must not simply be boosted.
- Use registered properties. Do not post affiliate links to Whatnot corporate social pages.
- Do not promise combined buyer-referral and affiliate benefits or invent coupon/credit amounts.
- Affiliate email promotions have a brand review/copy requirement; physical materials need prior written approval. This release does not send affiliate emails or print materials.

No ad spend is initiated by this integration. The original $300 month-one ceiling remains unchanged.

## References

- https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/tracking/tracking-links/create-and-manage-links/publisher-tag-implementation-for-partners
- https://integrations.impact.com/partner-api-reference/reference/tracking-links/tracking-links
- https://integrations.impact.com/partner-api-reference/reference/actions/actions
- https://integrations.impact.com/partner-api-reference/reference/actions/models

## Rollback

Set cached `impact-whatnot` links inactive to fall back to direct Whatnot destinations. Remove/disable the publisher component to stop page measurement. Remove the server-side Impact credentials to stop new API syncs. Keep the buyer referral route and show schedule intact. Do not erase existing snapshots or publication evidence.
