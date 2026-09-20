# tolley.io/stream — agent operating guide

Any agent (Claude on the DGX "Spark", Grok Bot on the Windows PC, Codex on the Mac) controls the
house live pipeline through ONE HTTP API on the DGX stream director. Same commands, same power,
every call is logged with the agent's name.

## Endpoints
- LAN:    `http://192.168.2.104:8097`
- Remote: `https://stream-api.tolley.io` (same API through Cloudflare)
- Auth:   header `x-api-key: <your agent key>` on every request. Keys are per-agent (`AGENT_KEY_*`).

## Commands
| Action | Call |
|---|---|
| Status (cameras 1–4, OBS scene, pushers, PC / LIVE Studio state, timers, events) | `GET /status` |
| Go live (arm the house; opens LIVE Studio on the PC unless `studio:false`; starts enabled pushers) | `POST /go-live` `{"destinations":{"youtube":true,"tiktok":false,"whatnot":false},"studio":true}` |
| Rehearsal (cameras allowed in, program recorded on the NAS, nothing pushed anywhere) | `POST /go-live` `{"destinations":{"youtube":false,"tiktok":false,"whatnot":false},"studio":false}` |
| **Cut to a camera** (picture only; 409 if that camera isn't connected while armed) | `POST /camera` `{"slot":2}` |
| Move the **audio lock** (the one mic that stays on air whichever picture shows; default slot 1) | `POST /camera/audio` `{"slot":1}` |
| Multiview thumbnail, ~1 fps JPEG, armed only, 404 when stale (>10 s) | `GET /thumb/cam1.jpg` … `cam4.jpg`, `GET /thumb/program.jpg` |
| Legacy RTMP credential endpoint (not the current Whatnot workflow) | `POST /destinations/whatnot/key` — do not use for WHIP shows |
| End / kill switch (stops pushers + OBS output, blocks the camera, closes LIVE Studio on the PC) | `POST /end` `{"reason":"..."}` |
| Privacy slate on/off (camera + mic hidden from viewers) | `POST /privacy` `{"on":true}` |
| Toggle a destination while live | `POST /destinations` `{"youtube":true}` |
| Rotate a camera key (Telegrams the new SRT + RTMP settings for that slot; default slot 1) | `POST /rotate-key` `{"slot":1}` |

CLI wrappers do the same thing:
- DGX / Mac (bash): `stream status | go-live [youtube] [tiktok] [whatnot] [nostudio] | end [reason] | privacy on|off | cam 1-4 | audio 1-4 | dest youtube|tiktok|whatnot on|off | whatnot-key <url> <key> | whatnot-key clear | rotate-key [slot] | pc <powershell>`
- Windows PC (PowerShell): `stream status | go-live [youtube] [tiktok] | end | privacy on|off | dest youtube on|off`

## Cameras (slots 1–4)
- Each slot has its own 32-hex key (`CAM_KEY`, `CAM2_KEY`…`CAM4_KEY` in stream.env; `/status` only ever shows the last 6 chars as `keyTail`).
  Phones publish with Larix Broadcaster over house Wi-Fi: **SRT** `srt://192.168.2.196:8890`, streamid `publish:live/<key>`
  (or RTMP `rtmp://192.168.2.196:1935/live/<key>`; off-LAN `rtmp://tolleystream.servemp3.com:1935/live/<key>`). Publishing only works while armed.
- Per-slot env (optional): `CAMn_LABEL` (name on the page), `CAMn_ROTATION` (0 for phones sending portrait; slot 1 falls back to `CAM_ROTATION`), `CAMn_SYNC_MS` (audio sync offset).
- `/status.cameras[]` = `{slot,label,connected,kbps,onAir,audio,audioLive,keyTail}`. `audio` = the lock, `audioLive` = the mic actually on air right now.
- OBS: inputs `Camera`, `Camera 2..4` all live in the `Live` scene. The audio-lock cam is the bottom layer, always enabled (mic stays active); the on-air cam is the one enabled layer above it; every other cam is hidden + muted but stays connected, so cuts are instant. Scenes (Live/BRB/Privacy/Ending) are unchanged.
- Per-destination re-encode: `<DEST>_BITRATE_K=4500` in stream.env makes that pusher re-encode with NVENC CBR at that bitrate instead of `-c copy` (unset = copy).

## What the house does on its own (don't duplicate it)
- Any camera present → Live scene. ALL cameras gone > 5 s → Be Right Back slate. A camera back → Live.
- On-air camera drops while another is connected → automatic cut to the lowest connected slot (Telegram note). If the audio-lock phone drops, the on-air camera's mic takes over until it returns.
- No camera connects within 120 min of arming → auto end. All cameras gone > 15 min after one connected → auto end. Max 8 h.
- Telegram alerts on every transition; Telegram commands `/kill /status /brb /live /cam N` from Jared's chat.
- Recording of the finished program on the NAS: `/volume1/UserFolder/Jared/stream-recordings/program/`.

## Order of operations for a stream
1. `go-live` (page, CLI, or API). The house arms and the camera is allowed in.
2. Jared starts the phones in Larix Broadcaster (settings on the /hq cards). Camera tiles turn green; `cam N` / keys 1–4 on the page cut between them.
3. TikTok: LIVE Studio auto-opens on the PC; a HUMAN clicks Go LIVE and pins products (TikTok allows no automation there). Jared does this from the Mac via Chrome Remote Desktop.
4. Whatnot uses WHIP through the Windows PC OBS, not the director RTMP pusher. Arm the house with all destinations false and studio:false; start cameras. On the PC, open the show’s OBS Tools in Seller Hub, Connect the PC OBS, then Start Show. Keep that browser tab open. Manage auctions/chat in Whatnot. End the show in Whatnot before ending the house. The director showing Whatnot “not configured” does not determine whether a WHIP show is live.
   Official workflow: https://help.whatnot.com/hc/en-us/articles/5497980244749-Using-OBS-with-your-Livestream
5. After ending each platform’s show, `end` when done. Everything stops (all cameras are kicked — RTMP, RTSP and SRT), including LIVE Studio.

## Hard rules for agents
- Never `end` a stream Jared is running unless he asked, or a safety rule fires (camera gone, max length).
- Never `rotate-key` mid-stream — it kicks that camera.
- Never touch the NAS MediaMTX container, the DGX OBS, or the PC's OBS while armed. Ask the director instead.
- Don't try to click inside TikTok LIVE Studio. Don't install anything on the PC without Jared.
- The camera key and platform keys live only in `~/.config/tolley-security/stream.env` on the DGX. Never copy them elsewhere.

## Machines
- DGX "Spark" 192.168.2.104: director + headless OBS (`systemctl --user status stream-director obs-headless`), logs `journalctl --user -u stream-director`.
- NAS 192.168.2.196: MediaMTX (`ssh Jared@192.168.2.196`, compose in `/volume2/shared/stream/mediamtx`).
- Windows PC 192.168.2.42 (`ssh tower@192.168.2.42`, PowerShell): OBS virtual camera + poller (`C:\ProgramData\tolley-stream\poller.log`), TikTok LIVE Studio.
- Control page for Jared: https://www.tolley.io/stream (owner login + MFA).

## Public hub and clips
- `/live` is public. `/stream` and `/stream/growth` remain owner-only.
- Armed, encoding and sending are distinct from a platform-confirmed live show. Confirm public Whatnot live state only after checking Seller Hub; the public flag expires automatically.
- Chat here covers YouTube/TikTok only; Whatnot chat stays in Seller Hub.
- `/status.recording` reports a read-only NAS file freshness check, not an OBS recording flag. `unknown` is not healthy.
- Clip worker: `tolley-stream-clips.timer`; skips work while house armed/encoding. It never starts/stops streams or deletes archive recordings.
- Clip publishing pause, held/uncertain results, schedule and show ledgers: `/stream/growth`. Existing in-flight network requests may finish after pausing.
- Explicit verified social account bindings are required. Never use another brand’s most recent OAuth connection.
- Source recordings before worker installation are excluded unless deliberately selected for a test.
