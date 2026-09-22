# Tolley Stream Coach

Owner-only `/stream/coach`, linked from `/stream`. Covers the owner's own shows: live chat questions, hosting prompts, manually entered USD sales, observed chat names, saved recaps, JSON snapshot export, and asynchronous local-model questions. It does not implement Ghost Agent's competitor network, creator revenue enrichment or cross-room buyer identities.

## Data and behavior

The independent loopback service reads the YouTube/TikTok collector every three seconds, including while the page is closed. By default it starts a saved session when an owner-verified live source appears. It finishes automatic capture after three minutes of confirmed offline status or source replacement. Network failures remain unknown; they never manufacture the end of a show. Manual start/finish is available. Finishing manually suppresses that source until a different show appears or automatic detection is explicitly re-enabled. Pausing automatic detection leaves an existing capture session running; finish tracking separately to stop capture.

YouTube discovery uses the existing owner's OAuth connection and checks the channel ID before querying active broadcasts every 45 seconds. It falls back to strictly verified public player metadata if the API is unavailable; archived broadcasts are not live. Concurrent viewers are read from the official video API every 30 seconds while live. TikTok uses the existing TikTokLive collector and binds observations to the configured owner's actual room ID. Its concurrent count is the observed room count, including zero. Timestamped viewer samples and observed peaks are saved per show; missing samples stay unknown. These counts are not unique people and do not prove retention or conversion.

Chat/gift/join events use platform event IDs where available to deduplicate reconnects and bind to the observed video/room. Starting late cannot recover earlier chat. The collector has a 2,000-event buffer; outages can lose messages. The dashboard uses up to 20,000 recent events and labels truncation; older SQLite records remain saved. Snapshot exports are bounded dashboards, not full database archives. Display names are counted per platform, not represented as verified identities or unique viewers. Gifts never count as revenue. Keyword/question-mark flags may be false positives; spoken responses cannot be detected. USD sales remain manual gross sales, before fees, refunds and costs; voiding retains the original row.

The Whatnot observer reads the actual public `treasure_hauls` profile every three minutes in its own tabs of the existing local browser. It saves exact follower/lifetime sold counts with timestamps (rounded counts are rejected), independently of show sales. History is persisted approximately every five minutes. Browser failures remain unavailable/stale. The observer does not copy cookies, send messages or operate a show. **Private Whatnot orders and chat are not connected**: the collector browser is signed out, and a seller data adapter must be verified after login. Public lifetime sold counts never become show orders or revenue. No competitor scraping or cross-room enrichment is implemented.

The local model reads bounded show records and returns advice only; it has no tools or secrets. Jobs are persisted before inference; failed/interrupted jobs have visible errors and can be retried. Inference has a 60-second timeout, one pending request at a time and a 60/hour cap. There is no paid-provider fallback. Treat generated advice as suggestions and check it against the displayed records.

## Runtime and security

`service.py` binds to 127.0.0.1:8106. SQLite lives under `~/.local/state/tolley-stream-coach/coach.sqlite3` (directory 0700, file 0600; service umask 0077). Back up that directory with a SQLite online backup while running or stop only the coach before copying its SQLite/WAL files. No platform credentials are stored in it. The existing director exposes only `/coach/snapshot`, `/coach/action`, `/coach/ask` behind its existing authenticated key check. Next's `/api/stream-coach/*` checks the owner/MFA session, exact route/method allowlist, cross-origin writes, body limits and no-store caching. `/stream`'s existing owner layout protects the page. The separate worker cannot access broadcast commands.

Run `~/stream-director/.venv/bin/python ops/stream/coach/install.py` after tests. The installer refuses an armed, encoding or sending house, backs up SQLite online and prior source files, installs the coach, chat collector and Whatnot observer services and checks the authenticated proxy. It does not modify keys or OBS configuration. It restarts the director only if its proxy changed, and only while idle. An automation-only upgrade leaves the director running.

Rollback web via the previous deployment. Stop/disable `tolley-stream-coach.service` and `tolley-whatnot-observer.service`; the director returns a recoverable coach-unavailable response and normal stream controls continue. Keep the saved database. If removing the director proxy, restore its `before-coach` backup only while idle.

## Validation

- `~/stream-director/.venv/bin/python ops/stream/coach/test_service.py` exercises persistence, message/sale deduplication, source boundaries, timestamps, question resolution, gross-sale math, voiding, concurrent-session rejection, interrupted model jobs and director authentication/route limits.
- `browser_fixture.py` starts an isolated synthetic backend on 8095. It uses a temporary SQLite database and never accesses the production collector. The browser test points a local app at this fixture and an isolated PostgreSQL test DB; its only model call is to the local inference service.
- `tests/stream/coach-browser.ts` covers owner/MFA access, anonymous denial, CSRF, route allowlist, saved question/sale actions, a real model answer and phone/desktop layouts.

- `test_automatic.py` covers automatic show boundaries, reconnection deduplication, zero/missing/stale audience measurements, archive rejection, suppression and public lifetime counts staying out of show revenue.
- `test-whatnot.mjs` validates public profile identity, exact counts, rounded-value rejection and login boundaries.
- Browser coverage additionally checks detection controls, true zero concurrent viewers and the separate Whatnot profile card.

Production acceptance requires authenticated snapshot health, correct owner/offline state, fresh actual Whatnot public counts, and no unintended tracking sessions. Private order sync remains blocked on seller authentication and adapter verification; it is not reported as connected.

Validated September 21, 2026: 15 service tests, 16 automation/API tests and four public-profile parser cases passed. Desktop/390px browser checks passed owner/MFA authorization, cross-origin rejection, detection toggles, persisted sales, zero audience counts and a real local-model answer. Production observes the verified YouTube channel as offline and Whatnot public counts as 68 followers / 97 lifetime sold; no synthetic sessions were installed. TikTok currently reports no readable room for @digiegold, and Whatnot seller authentication is still required. The broadcasting director was not restarted.
