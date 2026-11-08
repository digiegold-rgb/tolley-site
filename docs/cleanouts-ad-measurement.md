# Cleanouts ad measurement

The Cleanouts quote form captures an OpenAI `oppref` click reference separately from campaign, browser-referral and customer-reported attribution. Only the reference and capture time go into session storage, capped at 30 days. Global Privacy Control and Do Not Track disable capture and clear that reference. The server also checks the corresponding headers.

After the lead/customer transaction commits, a separate Next `after()` callback sends `lead_created` to OpenAI Conversions API. The stable event ID is based on the saved lead ID; retries use the exact same payload for deduplication. No names, contact details, job notes, IP addresses, SMS-consent values, or monetary values are sent. Requests without a click reference are skipped. This is click-attributed quote reporting, not completed-call, view-through, booked-job, or revenue tracking.

Production requires `OPENAI_ADS_PIXEL_ID` and server-only `OPENAI_ADS_CONVERSIONS_KEY` in the existing hosting project. Neither the conversion key nor the account-management key belongs in browser code. Create the source and `lead_created` event setting in Ads Manager, and attach that event setting to the campaign. A clicks campaign can report conversions without changing its objective or budget. OpenAI reserves the `oppref` URL parameter; retain the platform-provided identifier instead of adding it to the campaign query template.

Delivery retries at most three times with six-second timeouts. Permanent 4xx failures stop immediately; rate limits and transient failures retry. Exhaustion logs the saved lead ID only. The original lead and notification remain independent of ad reporting. There is no backfill of historical leads or contact-data matching.

## Verification

- `node --conditions=react-server --import tsx --test tests/openai-ad-conversions.test.ts tests/discovery.test.ts`
- `node tests/openai-ad-browser.mjs` against the isolated local app at port 3076. `OPENAI_TEST_BASE` may point to production; this test always intercepts quote submissions and creates no lead or notification.
- Use the Conversions API `validate_only: true` option for transport/schema checks. It records no conversion.
- `node --import tsx scripts/discovery-health.ts` checks published offerings and crawler access without submitting forms.
- Confirm the first genuine attributed quote in Ads Manager. A successful validation request does not prove that a real customer converted.

The public OpenAPI document also describes the direct free-quote endpoint, optional explicit SMS consent, saved `leadId` receipt, and failure responses. Discovery documentation is not an invitation to submit test inquiries to production.

## Owner quote alerts

The GrowthLead, customer link and Telegram owner-notification record commit in the same transaction. The response schedules immediate delivery through the existing lead-notification outbox; its cron retries failed delivery up to five attempts with backoff during the existing scheduled hours. A provider outage leaves the saved inquiry and pending alert intact. Exhausted attempts remain visible as failed notification rows. Delivery is at least once: a crash after provider acceptance can repeat an alert.

Cleanout alerts use plain text so punctuation in names and addresses cannot break Telegram Markdown parsing. Other Telegram callers keep their existing formatting. The browser shows success only with an explicit successful saved-lead receipt. No historic quotes are backfilled or re-notified.

Verify the transaction boundary with `node --conditions=react-server tests/cleanouts-quote.mjs`, and retry, rollback and concurrent delivery with `tests/revenue-outbox.ts` against its required isolated database. The latter intercepts Telegram HTTP calls; it sends no owner message.
