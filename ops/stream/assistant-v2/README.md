# Inventory Assistant V2

Separate Whatnot assistant, explicit owner Start, installed paused. Classic is preserved. Operator workflow: `/stream/assistant` and `ops/stream/OPERATIONS.md`.

- `catalog-export.mjs`: Prisma transaction explicitly READ ONLY; minute snapshot of allowlisted Product, PlatformListing and StreamLineup fields. No schema changes, private prices, customer details or unverified descriptions. Snapshots expire after three minutes.
- `inventory.mjs`: typo-tolerant candidates and five-minute per-viewer context; existing loopback local model selects candidate IDs, intent and a literal fact index. All public prose comes from bounded templates. Model outage uses conservative matching, never unrestricted generation. Sold overrides active, drafts are qualified, show lineup binding is explicit per connected show. Physical inspection and missing facts stay with host.
- `engine.mjs`: existing Classic browser safeguards/greetings; 60 seconds between public messages, max 40/hour including announcements, five minutes per viewer. Pause/settings/lineup changes cancel pending interpretations. Evidence is rechecked before the browser sends; no automatic retry on uncertain sends.
- `shared-history.mjs`: separate settings/events; mirrored outgoing ledger and opt-outs share cooldowns across versions. Classic database schema/configuration are unchanged. Original Classic source/service are preserved.
- `director_routes.py`: authenticated allowlist for both dashboards. Serializes Start, requires the other worker paused and idle. Classic can start if V2 connection is refused. V2 additionally checks Classic each tick and send. Do not bypass the authenticated proxy with manual loopback Start requests.
- `server.mjs`/`web`: loopback 8112, CSRF, host validation, owner-only Next proxy, non-posting answer preview. A preview does not attach to Whatnot or invoke any message sender.

## Install and recover

Run `/home/jelly/stream-director/.venv/bin/python ops/stream/assistant-v2/install.py` from this checkout only while the house is idle. The installer checks armed/encoding/senders twice, copies runtime into `~/whatnot-inventory-bot`, installs a read-only exporter timer, and replaces only the existing assistant route module before restarting the idle director. It does not restart Classic or OBS. Exporter module resolution references this checkout's package.json, so retain the checkout and its node_modules link.

`systemctl --user status tolley-inventory-assistant tolley-inventory-catalog.timer`

Stop V2 using its Pause button, or stop `tolley-inventory-assistant.service` after its pending operation settles. Classic continues at `/api/stream/whatnot-bot/admin`; no broadcast restart is needed. Full route rollback, only while idle: restore the timestamped `~/stream-director/whatnot-bot-routes-backup-*.py` to `whatnot_bot_routes.py`, restart the director, disable the V2 service/catalog timer. Never delete shared history to bypass cooldowns. Keep credentials in their existing secure configuration, never in this directory.

## Verification

```
node --test ops/stream/assistant-v2/test/*.test.mjs
/home/jelly/stream-director/.venv/bin/python ops/stream/assistant-v2/test/proxy_test.py
```

Fixtures launch isolated headless browsers and intercept all Whatnot navigation; they do not log in or send real messages. `tests/stream/assistant-browser.ts` uses the local test database and owner/MFA fixture for website controls. See `VALIDATION.md` for installation evidence and remaining live acceptance.
