# Facebook LIVE preview + comments

The Spark sends its finished house program to the bound Facebook Page. The website
prepares/selects an unpublished Live Producer preview and explicitly enables its
sender. Publishing remains a human action in Facebook Live Producer. No route
creates `LIVE_NOW` or updates a video's publish status.

Target Page: `1156652300855210`, verified September 29 as **Ruthann's Treasure Haul**.
YouTube's owner API independently reported **Digital Gold Jelly Studio**,
`UCd4bJKIvbGOIAT-GK4K-3_w`. These are distinct from clip-publishing bindings.

## Install and verification

Read `../STREAM-AGENTS.md` and `../OPERATIONS.md`, then `stream status`.
Never install/restart while the house is armed or OBS encoding. Provisioning uses
the exact existing `LiveSettings` binding and Page connection, verifies `/me`, and
writes only the existing `~/.config/tolley-security/stream.env` (0600).

```sh
node --env-file=/home/jelly/.config/tolley-security/production.env ops/stream/facebook/provision.mjs
/home/jelly/stream-director/.venv/bin/python ops/stream/facebook/test_facebook.py
/home/jelly/stream-director/.venv/bin/python ops/stream/facebook/install.py --check
/home/jelly/stream-director/.venv/bin/python ops/stream/facebook/install.py
stream status
```

The installer checks live state, validates unique source anchors, compiles before
writing, and backs up only the director/chat/module Python source. Other director
integrations remain in place. It copies `facebook_live.py` and the repository's
`coach/stream_chat.py`, then restarts only `stream-director` and `stream-chat`.
It also adds `stream facebook status|prepare|select|send|stop` to the CLI.
No new dependencies, OBS profiles, NAS changes or Windows installations.

Facebook uses the existing pusher's H.264 NVENC CBR path at 4500 kbps, a 60-frame
keyframe interval and copied house AAC, reading the same SRT finished program.
Its FFmpeg output is discarded to avoid logging the secret ingest URL. The sender
will back off using the director's existing retry logic. Actual Meta ingest
picture/audio acceptance has not yet been measured; check Live Producer before
publishing. Status failure/staleness disables the sender, and a restart never
automatically resumes Facebook. A human may explicitly resume an already-public
selected video after confirming the public-feed warning.

## API and credential boundaries

Every director route requires the existing per-agent key. Website routes require
owner login + MFA; POST requests also require the website Origin and a body <=8KB.
The website never receives the Page token or ingest URL. `facebook-state.json`
contains only preview-creation intent and video ID, used to block duplicate
creation after ambiguous network failures. Runtime credentials remain only in
the secure env file. Do not print environment files, HTTP headers or FFmpeg args.

Only token-authenticated Graph v23 requests are used. `/me` must match the fixed
Page; the selected live video's `from.id` must match too. RTMPS hosts must be a
Facebook subdomain and use `/rtmp/`. Direct Graph response bodies never reach
logs/errors/status. Meta paging URLs are not followed; requests are reconstructed
with cursors and Authorization headers.

Comments are read only for the selected video while Meta reports `LIVE`.
Platform/source/event IDs deduplicate messages. Cursors drain pages in order;
failed cursors resume with an overlapping timestamp window. Source changes reset
the Facebook reader and remove old messages from the merged feed. An epoch lets
the browser recover when the chat process restarts and its sequence starts over.
The combined chat UI shows platform, timestamp and sender (or “Facebook viewer”
when Meta omits a name). Source identity is attached to each message; Facebook's
selected show is visible above the chat. No Facebook messages are sent or replied
to. Stream Coach saving remains YouTube/TikTok only.

## Tests and remaining live acceptance

`test_facebook.py` uses mock HTTP responses and temporary fake credentials. Tests
cover ownership mismatches, expired tokens, credential redaction, duplicate
preview prevention, allowed ingest addresses, authenticated send readiness,
explicit public-feed resume, generic-start rejection, comment paging/reconnect,
event dedupe and merged-feed epoch/source changes. It reads director *source* for
patch tests; it never imports the running director or connects to OBS.

`tests/stream/guide-browser.ts` uses the isolated local test database and mocked
control/chat responses. It verifies owner + MFA gates, mobile/desktop layout,
preview/send request bodies, duplicate/restarted chats, no automatic control
mutation on page load, and same-origin/body-size guards before proxy forwarding.

Authorized real read-only checks passed for Page identity, past live-video
ownership and comment access. Creating an unpublished preview succeeded; video
`122117051781297240` returned `UNPUBLISHED`. House and sender stayed off. Still
required with Jared's readiness: camera/audio through the Facebook preview, then
one real viewer comment on each of Facebook and YouTube plus a reconnect test.
Mocked messages are not proof of real viewer delivery or Meta ingestion.

## Rollback

While idle, restore `director.py` and `stream_chat.py` from the installer's printed
`~/stream-director/facebook-backup-<timestamp>` source directory; restore its
`facebook_live.py` too if present. Restart those two user services. An unused new
module can remain on disk. Restore `agents/stream` from `stream-cli` in that backup
if removing the CLI entry too. Do not restore or delete `stream.env` or camera keys.
Revert the website feature commit if needed. End any platform shows deliberately
in Live Producer before stopping their transport.

## Primary API references

- [Meta Page generated SDK: live_videos](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/page.py)
- [Meta LiveVideo fields, status enums and comments](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/livevideo.py)
- [Meta Live Video streaming guide](https://developers.facebook.com/docs/live-video-api/guides/streaming/)

The prose documentation fetch was unavailable during setup. Endpoint contracts
were checked against Meta's maintained SDK and the authorized real API probes;
successful clip publishing was not used as evidence of live-comment permission.
