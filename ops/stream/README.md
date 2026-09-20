# Treasure Hauls operations

`/live` is the public hub; `/stream/growth` is the owner-only schedule, publishing pause, clip outcomes and show ledger. Adding a schedule here does not create a Whatnot show. Create it in Seller Hub, then paste its direct URL. A manually confirmed live flag expires after the configured show duration and can be ended immediately. Do not invent a start time.

Verified September 19, 2026: the old digie86 invitation returns 404; https://www.whatnot.com/invite/treasure_hauls names the correct account. The stable first-party share URL is https://www.tolley.io/go/whatnot?utm_source=instagram (or youtube/facebook). Count clicks separately from Whatnot referral conversions.

## Installation

- Apply `prisma/migrations/20260920_live_growth/migration.sql` transactionally (`ops/stream/migrate.ts` for this repo's additive SQL deployment workflow). No existing tables are changed.
- Run `ops/stream/seed.ts` with the existing production environment. It binds only the API-verified Treasure Haul Facebook page and sets the verified referral. Saved YouTube/Instagram connections currently belong to Your KC Homes, so those remain unbound.
- Bind another platform only after verifying its identity using its API and obtaining the correct brand connection. LiveSettings.bindings keys: facebook/instagram/youtube, each `{accountId,label}`. Credentials stay in PlatformConnection, never in public metadata.
- Run `python3 ops/stream/deploy-director.py` only while idle; it refuses an armed/encoding house. No MediaMTX/OBS configuration is changed.
- Install the included user service/timer. Create `~/.local/state/tolley-stream-clips/installed-at` containing the current Unix timestamp before enabling it. Only newer finalized files are discovered.
- Worker uses the existing CPU Whisper installation, FFmpeg and local vision-capable model on 8356. No paid model fallback. Failed model/vision checks defer work. The service loads production credentials inside the Node bridge from the existing security environment file; it never copies stream keys.

## Publishing behavior

The worker reads the NAS archive over SSH/SCP, never deletes or modifies archive files, and maintains its own SQLite discovery state/local clip workspace. Completed local source downloads are removed; NAS originals and held clip renditions remain intact. It checks that the house is idle before transcription, selection and rendering; CPU/IO priority are low. It does not watch Content Autopilot's publish inbox. Up to four candidate moments per recording are selected, each 20–45 seconds. Portrait output contains the whole picture, captions stay inside social safe areas, strong profanity is muted/bleeped. Transcript and rendered-frame review must both pass at >=95% model confidence. Model review is imperfect; uncertain/private/humiliating/current-offer clips are held locally, not uploaded. Review actual results during rollout.

Only clips entirely inside an owner-confirmed public show window are eligible: confirm the show in `/stream/growth` when Whatnot is actually live, and mark it ended when finished. Unassociated rehearsal footage stays local. Program recording filenames use UTC (verified against segment duration and NAS modification time), while NAS shell time displays CST and public shows display America/Chicago. The worker preserves modification times and holds any recording whose start+duration differs by over three minutes. Accepted clips upload to the existing media store and enter a separate durable queue. Row uniqueness plus a PostgreSQL advisory lock prevent concurrent duplicate claims. Maximum two attempts per platform in any rolling 24 hours. Pause affects subsequent calls; an already-running request can finish. A timeout/crash never automatically reuploads. Facebook stores its video ID before transfer and polls actual publishing completion. Unknown YouTube/Instagram results require checking the bound account and recording the known result before a deliberate retry. Do not delete an uncertain row and blindly resend.

The public highlights feed includes only accepted clips with a confirmed publication. Held clips remain private. All captions identify footage as a past show. Platform upload restrictions can still prevent public delivery; an API connection alone does not establish upload eligibility.

## Daily operation and experiment

Plan 1–3 hours daily. Rotate focused electronics, home/garage, and genuine estate/mixed shows. Schedule several shows ahead in Whatnot. Open with a preview and clear condition disclosures; repeat community segments and consistent titles. Use Whatnot-compatible bio wording: “Treasure Hauls: useful finds, odd discoveries, and good company. Daily live shows. Follow and bookmark the next haul.” Avoid off-platform purchase redirection in Whatnot content.

Six matched show budgets: $0/$10/$0/$20/$10/$20 TOTAL per show, with $40 reserved out of the $100 total experiment. No programmatic ad purchases. Record platform fees, free inventory as $0, fulfillment/transport, refunds, labor and actual ad charges. Reconcile statements before calling results settled. Do not subtract ad charges twice if included in an earnings figure. Compare after-cost contribution per hour, sell-through and returning buyers; attributed ROAS is not incremental profit.

## Validation / rollback

Run `tests/stream/core.test.ts`, `tests/stream/queue.test.ts` against ONLY `tolley_live_growth_test`, and `tests/stream/browser.mjs` against a local server. Queue tests make no platform calls. Rehearse camera dropout/audio fallback using simulated director responses before hardware testing with connected cameras. Hardware acceptance remains necessary when the iPhone/DJI are present.

Pause publishing from `/stream/growth`, stop the clip timer, and revert the web deployment to roll back. Retain DB tables and archive media. Restore the director's pre-change backup only while idle. Re-enable only after identity, privacy review, recording health and end-to-end publishing checks pass.
