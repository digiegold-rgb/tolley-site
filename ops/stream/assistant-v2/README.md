# Show Assistant — greetings and inventory together

Jared requested one assistant instead of separate V1/V2 choices. `/stream/assistant` is the single entry; both historical API dashboard prefixes resolve to port 8112. The source directory retains its historical name. See `ops/stream/OPERATIONS.md` for nightly operation.

- Read-only minute catalog export allowlists Product/PlatformListing/StreamLineup fields; no costs, minimum prices, private notes or unverified descriptions. Three-minute freshness limit.
- Existing local model selects candidate IDs and literal facts. Public prose uses bounded templates. Sold overrides active; drafts/backstock are qualified; lineup selection is per connected show. No automatic Whatnot auction import, camera vision or audio understanding.
- Greetings, thank-yous and announcements are included. Public messages: 60-second minimum gap, 40/hour maximum including announcements; repeated greetings/saved FAQs wait five minutes per viewer, inventory follow-ups may use the next minute. Uncertain sends never retry.
- Own settings/events database, with original outgoing history/opt-outs carried forward across both stores. One-time migration preserves configuration without overwriting later edits. Original source and database remain available for recovery; the original sender is stopped/disabled.
- Authenticated director allowlist aliases both old prefixes to one sender. CSRF/host checks and owner/MFA/same-origin website protection remain. Preview never connects to Whatnot or invokes a sender.

## Installation

Run `/home/jelly/stream-director/.venv/bin/python ops/stream/assistant-v2/install.py` from this checkout. It requires an idle house and both assistants paused/not busy. It backs up both SQLite databases, migrates settings once, disables the old sender, installs the upgraded runtime/timer, replaces the assistant route module and restarts the idle director. The assistant starts paused/disconnected. OBS/NAS/Windows are untouched.

The exporter resolves Prisma using this checkout's package.json and node_modules link; retain the checkout. Runtime is `~/whatnot-inventory-bot`; service is `tolley-inventory-assistant`. Minute catalog timer is `tolley-inventory-catalog`. State is `~/.local/state/tolley-inventory-assistant/`.

## Operator recovery

Pause/stop the upgraded worker first. Do not run two senders. Original Classic source/runtime at `~/whatnot-admin-bot` and its SQLite data under `~/.local/state/tolley-whatnot-bot` remain intact. To restore Classic as an operator rollback, while the house is idle restore the pre-V2 assistant route-module backup (`whatnot-bot-routes-backup-1790740089.py`) and restart the director, then enable/start `tolley-whatnot-bot.service`. Restore website entry wording if rollback is permanent. Never delete history to bypass cooldowns. The upgraded worker recognizes connection refusal as retired; timeouts/unknown failures fail closed, and a running previous sender blocks sending.

## Verification

```
node --test ops/stream/assistant-v2/test/*.test.mjs
/home/jelly/stream-director/.venv/bin/python ops/stream/assistant-v2/test/proxy_test.py
```

Isolated browser fixtures intercept all Whatnot navigation and send no real messages. `tests/stream/assistant-browser.ts` uses the local test database for owner/MFA, single-button navigation and layout checks. Live chat acceptance remains pending explicit owner Start. See `VALIDATION.md` for evidence.
