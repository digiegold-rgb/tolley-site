# Tolley Stream Coach

Owner-only `/stream/coach`, linked from `/stream`. First release covers the owner's own shows: live chat questions, hosting prompts, manually entered USD sales, observed chat names, saved recaps, JSON snapshot export, and asynchronous local-model questions. It does not implement Ghost Agent's competitor network, creator revenue enrichment or cross-room buyer identities.

## Data and behavior

The independent loopback service reads the existing YouTube/TikTok collector every three seconds. Chat is saved only during an explicitly started tracking session, including when the web page is closed. Tracking does not start/stop a stream, operate OBS, send replies or publish anything. End tracking after the show. A new YouTube video/account identity pauses that platform's capture in the old session; finish tracking and create a new session. Starting late cannot recover earlier chat. The collector has a 500-event buffer; outages can lose messages. The overview is limited to the most recent 20,000 events and explicitly labels that condition. Snapshot exports are bounded dashboard snapshots, not full database archives.

The existing collector has display names, not verified account IDs. Names are counted per platform and are never presented as unique viewers. Only chat/gift/join events are used; gifts are not revenue. Questions use transparent keyword/question-mark detection, may include false positives, and are marked handled by the owner because spoken responses cannot be detected. USD sale entries are manually recorded gross sales, not complete platform sales or profit. Voiding retains the original row. Sale request IDs prevent duplicates from retries. Show history remains available after restarts.

Whatnot chat and automated platform sales feeds are **not connected**. The existing Whatnot workflow stays in Seller Hub. Future work needs a verified source for those events before automatic revenue/buyer features or competitor claims can be added.

The local model reads bounded show records and returns advice only; it has no tools or secrets. Jobs are persisted before inference; failed/interrupted jobs have visible errors and can be retried. Inference has a 60-second timeout, one pending request at a time and a 60/hour cap. There is no paid-provider fallback. Treat generated advice as suggestions and check it against the displayed records.

## Runtime and security

`service.py` binds to 127.0.0.1:8106. SQLite lives under `~/.local/state/tolley-stream-coach/coach.sqlite3` (directory 0700, file 0600; service umask 0077). Back up that directory with a SQLite online backup while running or stop only the coach before copying its SQLite/WAL files. No platform credentials are stored in it. The existing director exposes only `/coach/snapshot`, `/coach/action`, `/coach/ask` behind its existing authenticated key check. Next's `/api/stream-coach/*` checks the owner/MFA session, exact route/method allowlist, cross-origin writes, body limits and no-store caching. `/stream`'s existing owner layout protects the page. The separate worker cannot access broadcast commands.

Run `~/stream-director/.venv/bin/python ops/stream/coach/install.py` after tests. The installer refuses an armed, encoding or sending house, preserves prior director/coach source files, installs the user service and checks the authenticated proxy. It does not modify keys or OBS configuration. It restarts the director only while idle.

Rollback web via the previous deployment. Stop/disable only `tolley-stream-coach.service`; the director returns a recoverable coach-unavailable response and normal stream controls continue. Keep the saved database. If removing the director proxy, restore its `before-coach` backup only while idle.

## Validation

- `~/stream-director/.venv/bin/python ops/stream/coach/test_service.py` exercises persistence, message/sale deduplication, source boundaries, timestamps, question resolution, gross-sale math, voiding, concurrent-session rejection, interrupted model jobs and director authentication/route limits.
- `browser_fixture.py` starts an isolated synthetic backend on 8095. It uses a temporary SQLite database and never accesses the production collector. The browser test points a local app at this fixture and an isolated PostgreSQL test DB; its only model call is to the local inference service.
- `tests/stream/coach-browser.ts` covers owner/MFA access, anonymous denial, CSRF, route allowlist, saved question/sale actions, a real model answer and phone/desktop layouts.

Validation on September 21, 2026: all 15 backend tests passed. The browser run passed the real owner/MFA gate, anonymous/cross-origin denial, both proxy allowlists, question handling, persisted sales, a real local-model answer using the $30.50 fixture total, all four views at 390px without horizontal overflow, and ending tracking. Desktop and phone captures are `/tmp/stream-coach-desktop.png` and `/tmp/stream-coach-mobile.png`. The installed worker uses an empty production database; the fixture is a separate temporary database. Director/OBS status remained idle after installation.
