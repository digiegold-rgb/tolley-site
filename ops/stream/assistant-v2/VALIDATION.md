# Unified Show Assistant validation — September 29

Jared changed the request from separate versions to one assistant. The upgraded worker includes the established greetings, thank-you DMs and announcements plus inventory answers. Both historical dashboard prefixes now resolve to that same worker.

- 28 Node tests passed: greeting/DM/live-session safeguards, isolated Whatnot DOM fixture, matching/context, ambiguity, sold/draft/show scope, freshness, constrained model output, private-field exclusion, preserved history, public rate limits, cancellation, same-viewer product follow-up, mobile preview and CSRF. Retired-worker connection refusal is accepted; unknown failures still fail closed.
- Two Python contracts passed: authenticated route allowlist and both aliases target port 8112; settings migrate once without overwriting later owner edits.
- Real read-only catalog: 1,906 records (54 listed, 624 drafts, 1,228 sold/unavailable), one saved 12-item lineup. No direct Whatnot auction import is claimed.
- Real local-model preview found the Fellow Stagg kettle, qualified it as catalog/backstock, and held its missing condition for host review.
- Migration verified original settings exactly preserved, 11 original history entries visible, new worker outgoing table empty. Previous service inactive/disabled; upgraded service active, paused/disconnected. Both authenticated URL prefixes returned the same worker CSRF token. No real chats, DMs or broadcasts started.
- Director verified idle before route restart; no OBS/NAS/Windows changes. Minute read-only catalog timer healthy. Timestamped SQLite migration backups and original runtime/source retained.
- Website checks use `tests/stream/assistant-browser.ts` with a local test database: owner/MFA, one button, canonical redirect, unified controls, desktop/mobile layout and zero sends. Runtime preview fixture checks are independent of website mocks.

Pending: owner-authorized live chat acceptance with a new viewer greeting and product question, and optional confirmed show lineup. Offline tests and previews are not proof of a live-platform send. Keep the assistant paused until owner Start.

An earlier broader Facebook harness hit its static 45-second freshness limit during cold compilation. No Facebook production behavior changed; the dedicated assistant browser checks cover this release.
