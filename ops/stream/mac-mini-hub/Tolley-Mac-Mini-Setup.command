#!/bin/bash
# Tolley Mac mini bootstrap. Public keys only. No credentials are embedded.
set -euo pipefail
if [ "$(uname -s)" != Darwin ]; then
  echo 'Run this setup on the Mac mini in macOS Terminal.' >&2
  exit 1
fi
umask 077
hub="$HOME/Desktop/Tolley Hub"
mkdir -p "$hub" "$HOME/bin" "$HOME/.ssh" "$HOME/.config/tolley-hub" "$HOME/stream-director/agents" "$HOME/.codex"
chmod 700 "$HOME/.ssh"
backup_stamp=$(date +%Y%m%d-%H%M%S)
for f in "$HOME/.ssh/config" "$HOME/.ssh/tolley-hub.conf" "$HOME/.codex/AGENTS.md"; do
  if [ -f "$f" ]; then cp -p "$f" "$f.before-tolley-$backup_stamp"; fi
done
touch "$HOME/.ssh/authorized_keys"
chmod 600 "$HOME/.ssh/authorized_keys"
spark_key='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAR34tBAM/x8tLHqb/MdfT+98Yn3Hc5EWaG+F93QQq5r jelly@gx10-adc6'
if ! grep -Fq "$(printf '%s\n' "$spark_key" | awk '{print $2}')" "$HOME/.ssh/authorized_keys"; then
  printf '\n%s\n' "$spark_key" >> "$HOME/.ssh/authorized_keys"
fi
mini_key="$HOME/.ssh/id_ed25519_tolley_hub"
if [ ! -f "$mini_key" ]; then
  ssh-keygen -q -t ed25519 -N '' -C "tolley-hub@$(scutil --get LocalHostName)" -f "$mini_key"
fi
chmod 600 "$mini_key"
cat > "$HOME/.ssh/tolley-hub.conf" <<'TOLLEY_SSH'
Host spark tolley-spark
  HostName 100.81.82.79
  User jelly
  IdentityFile ~/.ssh/id_ed25519_tolley_hub
  IdentitiesOnly yes
  ForwardAgent no
  ServerAliveInterval 30
  ServerAliveCountMax 3
Host streaming-pc
  HostName 100.98.175.104
  User tower
  IdentityFile ~/.ssh/id_ed25519_tolley_hub
  IdentitiesOnly yes
  ForwardAgent no
  ServerAliveInterval 30
Host tolley-nas
  HostName 192.168.2.196
  User Jared
  IdentityFile ~/.ssh/id_ed25519_tolley_hub
  IdentitiesOnly yes
  ForwardAgent no
  ServerAliveInterval 30
TOLLEY_SSH
touch "$HOME/.ssh/config"
if ! grep -Fq 'Include ~/.ssh/tolley-hub.conf' "$HOME/.ssh/config"; then
  { printf 'Include ~/.ssh/tolley-hub.conf\n'; cat "$HOME/.ssh/config"; } > "$HOME/.ssh/config.tolley-new"
  mv "$HOME/.ssh/config.tolley-new" "$HOME/.ssh/config"
fi
chmod 600 "$HOME/.ssh/config" "$HOME/.ssh/tolley-hub.conf"
touch "$HOME/.ssh/known_hosts"
spark_host='100.81.82.79,tolley-fixes.taile5cde9.ts.net ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH4pTYXKab5EWI8l6NUxnTieNXtmjZGr8l2LK/rqgnZb root@localhost'
if ! grep -Fq "$(printf '%s\n' "$spark_host" | awk '{print $3}')" "$HOME/.ssh/known_hosts"; then
  printf '\n%s\n' "$spark_host" >> "$HOME/.ssh/known_hosts"
fi
cat > "$HOME/bin/stream" <<'TOLLEY_STREAM'
#!/bin/bash
set -euo pipefail
# Keep the real CLI and all credentials on Spark. Bash %q safely quotes arguments.
cmd='$HOME/bin/stream'
for arg in "$@"; do printf -v escaped '%q' "$arg"; cmd="$cmd $escaped"; done
exec /usr/bin/ssh spark "$cmd"
TOLLEY_STREAM
cat > "$HOME/bin/spark-terminal" <<'TOLLEY_TERMINAL'
#!/bin/bash
exec /usr/bin/ssh spark
TOLLEY_TERMINAL
cat > "$HOME/bin/spark-codex" <<'TOLLEY_CODEX'
#!/bin/bash
exec /usr/bin/ssh -t spark 'cd /home/jelly && exec /home/jelly/bin/codex'
TOLLEY_CODEX
cat > "$HOME/bin/tolley-files" <<'TOLLEY_FILES'
#!/bin/bash
exec /usr/bin/open 'smb://192.168.2.196/UserFolder'
TOLLEY_FILES
chmod 700 "$HOME/bin/stream" "$HOME/bin/spark-terminal" "$HOME/bin/spark-codex" "$HOME/bin/tolley-files"
for rc in "$HOME/.zprofile" "$HOME/.bash_profile"; do
  touch "$rc"
  if ! grep -Fq '# Tolley hub PATH' "$rc"; then
    printf '\n# Tolley hub PATH\nexport PATH="$HOME/bin:$PATH"\n' >> "$rc"
  fi
done
export PATH="$HOME/bin:$PATH"
cat > "$hub/README.md" <<'TOLLEY_README'
# Mac mini control hub

Prepared October 5, 2026 for Jared. Installation and acceptance are pending until the setup command runs on the mini.

## Run once on the Mac mini

Save `Tolley-Mac-Mini-Setup.command` from Tailscale's incoming files into Downloads. In Terminal run:

```sh
bash ~/Downloads/Tolley-Mac-Mini-Setup.command
```

The script authorizes Spark's existing public SSH key, creates a separate private key on this Mac, adds SSH aliases and stream/Spark launchers, writes this machine's identity and agent instructions, and creates a Desktop/Tolley Hub folder. Existing SSH config and agent instructions are preserved. No password or private key is sent back.

In System Settings → General → Sharing enable **Remote Login** and **Screen Sharing**, each restricted to your Mac user. If Remote Management is already enabled, review it before switching to Screen Sharing; the two cannot run together. The script opens Sharing settings but does not change their access controls.

Send the short Mac username shown by Remote Login. The script also attempts to return `tolley-mac-mini-identity.txt` through Taildrop; it contains that username, hardware/software identity and the mini's public key. Once it arrives, the agent can finish and verify outbound connections.

## Machines and responsibilities

| Machine | Address | Responsibility |
| --- | --- | --- |
| Streams Mac mini | `100.96.109.9` / `streams-mac-mini.taile5cde9.ts.net` | Primary operator hub: Safari, screen sharing, SSH and shared-file access |
| Spark / GX10 | `100.81.82.79` / LAN `192.168.2.104` | Current director, house OBS, assistant, workers and existing Codex |
| Windows streaming PC | `100.98.175.104` / LAN `192.168.2.42` | Whatnot OBS/WHIP and TikTok LIVE Studio |
| DXP2800 NAS | LAN `192.168.2.196` | Shared files, MediaMTX and finished recordings |
| MacBook Pro | `100.73.77.9` | Optional screen-sharing client; offline during initial audit |

Another tailnet node is named `spark` at `100.83.26.125`. It is **not this session's verified GX10 director host**. Use the explicit addresses above and recheck rather than changing routes based on a display name.

The mini's LAN address during setup was `192.168.2.171`; Wi-Fi DHCP can change it. Use its Tailscale address for remote access. Exact chip, OS and local username are captured by setup; they have not been guessed.

## Use the mini from your MacBook Pro / Mac Pro

Keep Tailscale connected on both Macs. In Finder press ⌘K and connect to:

```text
vnc://100.96.109.9
```

Sign in with the mini's allowed local Mac account. This controls Safari and other apps on the mini. The laptop remains the display/keyboard; the mini is the operator workstation.

For Terminal use `ssh YOUR_MINI_USERNAME@100.96.109.9`. The laptop's own public key can later be authorized without copying a private key from another machine. Password authentication can also use the mini's account if allowed by its SSH service. Mac-to-mini screen sharing and laptop-to-mini SSH still need an actual client test.

## Safari and the assistant

Open Desktop → **Tolley Hub** → **Open Hub.command**. It opens Safari to HQ, stream controls and the existing Show Assistant:

- HQ: https://www.tolley.io/hq
- Show Assistant: https://www.tolley.io/stream/assistant
- Streaming guide: https://www.tolley.io/stream/guide
- ChatGPT: https://chatgpt.com/

Sign in through the existing owner login/MFA on this Mac. Apple ID does not sign you into Tolley or ChatGPT. Browser sessions are not copied. Safari controls the same assistant running on Spark; moving the browser does not require moving that worker. Connect the correct show and press Start only when you want replies.

The prepared HQ addition gives direct Show Assistant and Mac mini setup links. It remains a source change until its website deployment is verified.

## SSH from the mini

After the mini's public key is authorized on each target:

```sh
ssh spark
ssh streaming-pc
ssh tolley-nas
stream status
spark-codex
```

`stream` securely delegates every command to the current Spark CLI. It does not keep any camera, platform or director API credential on the mini. `spark-codex` launches the existing Codex CLI on Spark through SSH; its working files and execution platform remain Linux on Spark. It opens a new interactive session; it does not automatically resume this conversation. `spark-terminal` opens a regular Spark shell.

Use `ssh -J YOUR_MINI_USERNAME@100.96.109.9 jelly@100.81.82.79` if you specifically need the mini as a jump host. Your client must have credentials accepted at each host; `ProxyJump` does not reuse the mini's private key. Ordinary work is easiest by screen-sharing the mini and opening its Terminal. No SSH-agent forwarding is enabled.

## Shared files and adding a server

The verified NAS SMB shares include `UserFolder` and `personal_folder`. From the mini on home Wi-Fi, Finder → Go → Connect to Server (⌘K):

```text
smb://192.168.2.196/UserFolder
smb://192.168.2.196/personal_folder
```

Choose Registered User, use your NAS account (existing operator is `Jared`), and save the password in macOS Keychain if desired. In `UserFolder`, recordings are under `Jared/stream-recordings/program`. Add the mounted folders to the Finder sidebar. The setup includes clickable `.inetloc` shortcuts and `tolley-files` to open the NAS connection dialog.

`/volume2/shared` on the NAS is the existing Spark NFS workspace, mounted at `/mnt/nas-ssd`. It was **not listed as an SMB share** in the NAS audit. Do not assume `smb://192.168.2.196/shared` exists. A new SMB export or Mac NFS mount needs separate configuration and verification.

For a new file server: enable an SMB share on that server, create an account with access to the intended folder, and connect from Finder using `smb://SERVER_ADDRESS/SHARE_NAME`. Save the address with the + button in Connect to Server. If the server is remote, use its Tailscale address or an existing approved private network route. The NAS currently has no verified Tailscale node, so its LAN SMB shortcuts are for the mini at home. Screen-sharing the home mini gives you that home-network access while away.

Sharing a folder *from* the mini is optional: enable File Sharing, add only that folder and the intended users, and enable SMB. Do not share the entire home folder, `.ssh`, browser profiles or credentials. No mini SMB server was enabled by this package.

## Streaming handoff

Read `STREAM-AGENTS.md` and `OPERATIONS.md` in the Tolley Hub folder before operating. During the initial audit the house was armed in rehearsal, the camera was absent and all house public destinations were off. This is a dated observation, not proof that the Windows Whatnot show is offline. No broadcast, assistant Start, key rotation, OBS restart or director restart was performed for hub setup.

Moving operator controls is distinct from replacing the Windows video path. Continue using Windows Show Tools/OBS for Whatnot and human TikTok LIVE Studio controls. The mini needs screen access to Windows too: the hub links to the existing Chrome Remote Desktop service; sign in and verify that machine there. The service's page alone does not prove a remote session works. No camera ingest, WHIP show connection or Mac OBS migration is included.

## Keep it reachable

Keep Tailscale connected and enable its available launch-at-login option. In System Settings → Energy enable prevent automatic sleep when the display is off, wake for network access, and restart after power failure as appropriate for this stationary hub. Review actual settings before applying them. FileVault can require a local unlock after a cold restart; do not disable disk encryption just to bypass that. Keep the existing LAN connection available during setup. Ethernet can be added later without changing these SSH aliases.

## Acceptance still required

- Spark → mini SSH authenticates and reads real identity.
- Mini → Spark, Windows and NAS SSH authenticate with the mini's new key.
- `stream status` on the mini succeeds through Spark.
- MacBook Pro/Mac Pro → mini Screen Sharing works with the intended account.
- Safari owner login and Show Assistant display correctly.
- NAS share mounts and intended folders are accessible.
- Windows remote desktop works from the mini.
- Mini sleep/login behavior is checked; a reboot test occurs only at a suitable time.

Official references: [Apple Remote Login](https://support.apple.com/guide/mac-help/allow-a-remote-computer-to-access-your-mac-mchlp1066/mac), [Apple Screen Sharing](https://support.apple.com/en-gb/guide/mac-help/mh11848/mac), [Apple shared servers](https://support.apple.com/en-au/guide/mac-help/mchlp1140/mac), [SSH over Tailscale](https://tailscale.com/docs/reference/ssh-over-tailscale), [Codex CLI](https://learn.chatgpt.com/docs/codex/cli), [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
TOLLEY_README
cat > "$hub/Hub.html" <<'TOLLEY_HTML'
<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tolley · Mac mini hub</title>
<style>body{font:17px system-ui;background:#101925;color:#edf4fa;max-width:850px;margin:50px auto;padding:0 24px}h1{font-size:36px;margin-bottom:8px}p{color:#b5c9da;line-height:1.6}.links{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin:30px 0}a{color:#8cdece} .links a{display:block;background:#1e3043;border:1px solid #38546e;padding:24px;border-radius:14px;text-decoration:none}small{display:block;color:#b5c9da;margin-top:8px}code{color:#addfe9}li{margin:12px 0;line-height:1.5}</style>
<h1>Mac mini control hub</h1><p>Your operator workstation for HQ, Show Assistant, shared files and Spark.</p>
<div class="links">
<a href="https://www.tolley.io/hq">Open HQ<small>Your owner dashboard</small></a>
<a href="https://www.tolley.io/stream/assistant">Show Assistant<small>The existing assistant on Spark</small></a>
<a href="https://www.tolley.io/stream">Stream controls<small>Check current house state</small></a>
<a href="https://www.tolley.io/stream/guide">Streaming guide<small>Show setup and operating rules</small></a>
<a href="https://remotedesktop.google.com/access">Windows remote desktop<small>Sign in and select the streaming PC</small></a>
<a href="https://chatgpt.com/">ChatGPT<small>Sign in to your account</small></a>
<a href="smb://192.168.2.196/UserFolder">NAS shared files<small>Connect with your NAS account</small></a>
<a href="smb://192.168.2.196/personal_folder">NAS personal folder<small>Existing personal file share</small></a>
</div>
<p>To control this mini from your other Mac, keep Tailscale connected on both, open Finder → Go → Connect to Server, and enter <code>vnc://100.96.109.9</code>. Screen Sharing must be enabled for your mini account first.</p>
<p>For Terminal, use the adjacent <strong>Spark Terminal.command</strong> or <strong>Codex on Spark.command</strong> shortcut. <code>stream status</code> runs through Spark. The full setup and server instructions are in <strong>README.md</strong>.</p>
<p>Sign in to Tolley with your existing owner account and MFA. Check the correct show before starting the assistant. Spark runs the house; Windows handles Whatnot and TikTok.</p>
</html>
TOLLEY_HTML
cat > "$hub/AGENTS.md" <<'TOLLEY_AGENTS'
# Streams Mac mini identity and operating instructions

You are operating Jared's **Streams Mac mini**, the primary operator workstation for Treasure Hauls/Tolley. This machine runs macOS; do not run Linux `systemctl`, Windows PowerShell, or Linux package-manager commands locally. Read `~/.config/tolley-hub/identity.txt` for the actual username, macOS release, hardware model and architecture captured at setup. Query live identity/state when necessary.

The mini is on house Wi-Fi and Tailscale, currently `100.96.109.9` (`streams-mac-mini.taile5cde9.ts.net`). Spark is a separate Linux GX10 at `100.81.82.79`, LAN `192.168.2.104`, user `jelly`. Windows streaming PC is `100.98.175.104`, user `tower`. NAS is `192.168.2.196`, user `Jared`.

SSH aliases on this Mac: `spark`, `streaming-pc`, `tolley-nas`. Access to each target must be tested before claiming it works. The tailnet's other node named `spark` at `100.83.26.125` is not the verified director host for this setup. Do not confuse machine display names with tested service ownership.

The mini replaces the MacBook Pro as the operator hub; Spark retains house OBS, director, assistant and workers. Windows retains Whatnot WHIP/OBS and TikTok LIVE Studio. The NAS retains relay, files and recordings. The MacBook Pro/Mac Pro can control the mini by screen sharing. This operator migration is not authorization to relocate services or copy sessions/credentials.

`stream` on this Mac delegates securely through SSH to the existing Spark CLI, including facebook/effects/pc commands. It stores no camera or platform keys and no director API token on the mini. Before stream work read `~/stream-director/agents/STREAM-AGENTS.md` and `~/stream-director/agents/OPERATIONS.md`, then run `stream status`. These local guide copies may age; refresh from Spark before relying on dated observations.

Hard rules: never end Jared's stream unless asked or an established director safety rule fires; never rotate camera keys mid-stream; never touch NAS MediaMTX, Spark OBS or Windows OBS while armed; use the director. Never automate clicks inside TikTok LIVE Studio. Never copy camera/platform keys from Spark. Do not start broadcasts or assistant replies merely to test connections.

Safari: HQ `https://www.tolley.io/hq`, Show Assistant `https://www.tolley.io/stream/assistant`, stream controls `https://www.tolley.io/stream`. Use existing owner login/MFA. Apple ID is not the website login. Do not copy browser profiles or credentials. Connect and Start assistant require the owner's intended show and readiness.

Files: Finder ⌘K → `smb://192.168.2.196/UserFolder` or `smb://192.168.2.196/personal_folder`; recordings are `UserFolder/Jared/stream-recordings/program`. NAS `/volume2/shared` is currently a Spark NFS export; no SMB `shared` export was verified. Add new servers by their explicitly configured share name, with user-scoped access.

`spark-codex` runs Codex on **Linux Spark** over SSH; local commands in that session run on Spark, not macOS. It starts a new session and does not promise to continue a conversation in another app. The mini private key stays only in `~/.ssh/id_ed25519_tolley_hub`; authorize its public key on targets rather than copying old private keys. Do not enable agent forwarding.
TOLLEY_AGENTS
cat > "$HOME/stream-director/agents/STREAM-AGENTS.md" <<'TOLLEY_STREAM_AGENTS_md'
# tolley.io/stream — agent operating guide

## Latest shared handoff

Read [OPERATIONS.md](OPERATIONS.md) for the September 29 camera/audio findings, nightly Windows Whatnot workflow, single-DJI delay test, TikTok account gate and Facebook preview / combined-chat setup. The same document is served behind owner authentication at `/stream/guide` and linked from HQ Docs. Treat its hardware and platform observations as dated; query current state before acting.

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

## Facebook preview workflow

CLI: `stream facebook status | prepare [title] | select <video-id> | key <server-url> <key> [backup] | key --stdin | key clear | send <video-id> | golive [title] --confirm-public | end | stop`. For recovery of an already-public show only: `stream facebook resume <video-id> --confirm-public`, requiring Jared’s readiness.

Read `OPERATIONS.md` for the nightly steps. `GET /status.facebook` reports verified Page, selected video, Meta phase and errors; `destinations.facebook.running` reports transport only. The Page is fixed to `1156652300855210`.

- `POST /facebook/prepare {"title":"..."}` creates/reuses an **UNPUBLISHED** preview. It never publishes; on an ambiguous timeout, recover the existing preview in Live Producer.
- `POST /facebook/select {"videoId":"..."}` verifies Page ownership and selects an existing unpublished/live show while the Facebook sender is stopped.
- `POST /facebook/key {"server":"rtmps://…/rtmp/","key":"FB-…","backup":"FB-…"}` binds a stream key copied from Live Producer (manual ingest mode) while the sender is stopped; all fields empty clears it. The video ID comes from the key. Meta returns Graph code 100 for such a video until it goes live, so status reports phase `KEYED`; only in manual mode is that accepted for sending. Never print the key; `/status.destinations.facebook.keyTail` is the only echo.
- `POST /facebook/send {"videoId":"..."}` requires an armed, ready house and an unpublished selected preview or a loaded Live Producer key (`KEYED`). It only forwards the house program. Publish manually in Facebook Live Producer when Jared explicitly says he is ready.
- An already-public show can resume only with explicit `confirmLive` equal to that selected video ID. This forwards public picture/audio; do not issue it under preparation-only authorization.
- `POST /facebook/golive {"confirm":true,"title":"..."}` is the owner's one-click publish (added September 30 at Jared's request): requires an armed, ready house; binds/reuses a graph-mode unpublished preview (replacing a pasted key only while the sender is stopped), enables the sender, then a 3-second loop publishes `LIVE_NOW` once `ingest_streams.stream_health.video_bitrate > 0` or after 15 s of sending, retrying until 120 s (`status.facebook.goLive` = pending/live/failed, `goLiveError`). Agents run it only on Jared's explicit go-live instruction. `POST /facebook/end {}` ends the show on Facebook and stops the sender; a show this director published is also ended automatically when the house ends.
- `POST /destinations {"facebook":false}` stops the sender; end the Facebook show separately in Live Producer first. Generic toggles/go-live cannot enable Facebook. Restarting the director clears Facebook enablement.
- New credentials remain only in `~/.config/tolley-security/stream.env`. Do not print `FACEBOOK_PAGE_TOKEN` or `FACEBOOK_INGEST_URL`. Run `ops/stream/facebook/install.py` only while idle; it preserves other director integrations.

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
- The control page links to Show Assistant for Whatnot and no longer displays combined chat. The background reader still handles YouTube/TikTok and the selected Facebook live video; Facebook comments are not yet saved by Stream Coach.
- `/status.recording` reports a read-only NAS file freshness check, not an OBS recording flag. `unknown` is not healthy.
- Clip worker: `tolley-stream-clips.timer`; skips work while house armed/encoding. It never starts/stops streams or deletes archive recordings.
- Clip publishing pause, held/uncertain results, schedule and show ledgers: `/stream/growth`. Existing in-flight network requests may finish after pausing.
- Explicit verified social account bindings are required. Never use another brand’s most recent OAuth connection.
- Source recordings before worker installation are excluded unless deliberately selected for a test.
TOLLEY_STREAM_AGENTS_md
cat > "$HOME/stream-director/agents/OPERATIONS.md" <<'TOLLEY_OPERATIONS_md'
# Streaming operator guide

Updated October 4, 2026. Shared instructions for Jared and the agents maintaining Treasure Hauls. Available in HQ → Docs → Streaming & Show Assistant guide, and from the stream controls.

## Next show: quick start

There is **one Show Assistant** for viewer greetings, thank-you DMs, announcements and inventory answers. The old V1/V2 choice is retired; existing settings, message history, cooldowns and opt-outs are preserved. [Open Show Assistant](/stream/assistant) · [Open stream controls](/stream).

1. **Before going live:** open Show Assistant, check that inventory says **Fresh**, and try **Preview answer** with “Do you have any Stagg electric kettles?” Preview never posts. Try “What condition is it?” too; an unrecorded detail should be left for you rather than guessed.
2. **Prepare the picture and sound:** select the correct Whatnot show, arm the house with destinations off and LIVE Studio unchecked, start the house camera, and confirm picture plus moving audio in Windows OBS. Follow the Windows Whatnot steps below. A direct DJI USB feed is a different path; its detection remains unverified.
3. **Start the Whatnot show on Windows:** select **Whatnot Live (Recommended)** in OBS, connect the correct show through Whatnot Show Tools, then click **Start Show** when ready. Keep Show Tools open. Confirm the show is actually live before connecting the assistant.
4. **Connect the assistant:** paste that show's URL and click **Connect show**. You can also connect before starting the show: the assistant displays **Waiting for you to Start Show in Whatnot** and detects live chat automatically after you start it. Once connected live, optionally confirm the correct saved Tolley lineup. Without a selected lineup, it can still answer catalog/backstock questions, with availability qualified. Review settings, then click **Start assistant** when you want replies.
5. **Check the first real interaction:** have a viewer send a new “Hi” after Start, then a named-product question. Public messages are at least 60 seconds apart and capped at 40/hour, so allow time. Old comments are not replayed. Review **Questions and decisions** to see an answer's evidence or why a question was held for you. The first live inventory-answer acceptance test is still pending; previews and automated tests have passed.
   **Enable live promotion:** after verifying the show is publicly live, open [Growth](/stream/growth), find that exact show, and click **I verified this show is live on Whatnot**. House arming and the scheduled start time do not supply this confirmation. This enables the already-configured organic announcements and updates the public hub. Mark the show ended there when finished; its live confirmation also expires automatically.
6. **When finished:** click **Pause assistant**, end the show in Whatnot, then end the house after all platform broadcasts have ended. Pausing the assistant does not stop the camera or broadcast.

If **Connect show** fails, confirm the show is live and the Spark's existing Chrome session is still signed in as `treasure_hauls`. The assistant uses that browser session; Windows Chrome/OBS handles the separate Whatnot video connection. Do not restart OBS or change stream keys to fix assistant chat.

## Organic promotion

The dedicated Facebook show page has automatic scheduled feed previews. Live announcements are enabled for the explicitly bound Facebook/Instagram accounts, but require the exact show's verified live confirmation above. Dedicated show accounts get half-hour reminders; crossover accounts get the start announcement. YouTube has a separate video-clip workflow and does not support these text announcements. Story polls/countdowns/live cards remain manual. These workers do not purchase ads, and organic distribution does not guarantee audience reach.

October 2 audit: the publication ledger confirmed Facebook previews for October 1 and October 2. No live announcements were recorded for October 1; that show had no `liveStartedAt` confirmation. All five bound Facebook/Instagram identities passed read-only checks. The campaign heartbeat was current. Clip analysis had repeatedly failed at the model-selection stage; validated object/array handling was installed with three passing regression tests. A real recording run remains pending while the house is armed. No successful clip publication should be inferred from a timer finishing.

## Mac FaceTime camera into a house slot

The house already supports camera slots 1–4. A Mac webcam feed has **not yet been installed or visually verified**. Choose an unused slot, such as Camera 3; Camera 4 is also available. Use the selected slot's existing private camera key, never another active camera's key, and never rotate keys during an armed show.

On a Mac on the house network:

1. Install [OBS Studio for macOS](https://obsproject.com/download). In OBS → **Review App Permissions**, allow Camera. Add **Video Capture Device** and choose the built-in FaceTime camera. Close FaceTime or other apps using the camera if it is unavailable. See the official [camera source](https://obsproject.com/kb/video-capture-sources) and [permissions](https://obsproject.com/kb/macos-permissions-guide) guides.
2. Create a separate camera-only OBS profile and scene. Set the canvas to **1080×1920** and output to **720×1280 at 30 fps**, then fit the webcam into the canvas. This preserves the whole landscape picture inside the portrait house program. Start with H.264, CBR **3000 kbps**, and **2-second keyframes**. Keep the main house mic on Camera 1; disable Mac desktop and microphone audio for this camera feed.
3. In Settings → Stream choose **Custom**. Server: `rtmp://192.168.2.196:1935/live`. Stream key: the existing private key for the selected camera slot. Obtain it through the existing secure owner setup; do not paste keys into chat or documents. No public platform key is needed on the Mac.
4. With the house armed, click **Start Streaming** in Mac OBS to send this camera to the house relay. Confirm the chosen camera tile becomes connected in [stream controls](/stream), then select that slot. Check the program image, orientation and main microphone before using it on a public show. A connected tile alone is not a picture/audio acceptance test.

These LAN settings are for a Mac on the house network. A remote Mac requires a separate connectivity check. Installing/configuring the Mac publisher does not require changing the armed Spark or Windows OBS.

## Daily drafts and automatic inventory refresh

The assistant reads the saved **Tolley inventory every minute**, throughout the day and overnight. Ruthann's new drafts entered through Tolley's listing tools become available on the next successful refresh; there is no nightly wait or manual model training. During the September 29 setup, 15 new Tolley drafts automatically appeared in the assistant (624 → 639 drafts), confirming this path was working. Those counts are dated records, not a current physical stock count.

**Unpublished drafts created only inside Facebook Marketplace are not automatically imported by the existing Facebook mirror.** That mirror handles published inventory/status changes. Confirm where Ruthann creates a draft before assuming it is covered. Once the item exists in Tolley, the assistant can pick it up automatically. New Facebook-only draft import has not been enabled.

Freshness describes the latest database snapshot, not a physical count of the shelves. Drafts remain unconfirmed stock; sold/archived records override old active listings. Inventory older than three minutes stops product answers until a fresh snapshot is available. Missing details, current auction pricing and physical condition checks stay with the host. Tonight's Whatnot auction list is not imported automatically: select a saved Tolley lineup explicitly if it applies.

## Camera and platform readiness

October 2 YouTube repair: Jared explicitly selected **Digital Gold Jelly Studio** (`UCd4bJKIvbGOIAT-GK4K-3_w`). The saved house key was verified against that channel's **Testing Remote** input. Its earlier broadcast was complete; starting FFmpeg alone had not created October 1/2 broadcasts. Neither channel's API contained those shows. The installed lifecycle now creates a private, bound event and enables its public auto-start only when the owner turns YouTube on with an armed, ready house and a connected camera. The sender waits for a verified broadcast/input binding. YouTube `liveNow`, watch URL, channel and errors are available in owner director status and `stream status`; a running FFmpeg process alone is not a live acceptance test. Eleven regression tests passed and an actual private event was confirmed `ready`, correctly bound, with auto-start off. The next public picture/audio/archive acceptance test remains pending; no public show was started during this repair.

Facebook October 1 replay was verified published: https://www.facebook.com/122097093273297240/videos/1881049322879058 . The October 2 house session had Facebook disabled and no new Facebook live-video record. Facebook must be started separately through its **Go live on Facebook** control when Jared is ready. Camera/YouTube activation does not imply Facebook activation.

NAS program chunks for both October 1/2 house sessions were confirmed present. Their UTC filenames include setup/BRB footage; inspect and trim the intended public show window before proposing replay uploads. Do not publish whole archive chunks as if every minute had been public.


Use one DJI camera for the first test. Defer extra cameras and the other camera connections until later. The requested Facebook phase is now installed as an unpublished preview; public activation still waits for Jared. Prepare the preview first; Jared starts the public show when ready. A request to get ready is not permission to publish immediately or after an assumed countdown.

The DJI USB connection is **not verified**. Windows did not enumerate a DJI or UVC camera, and the camera did not offer its usual USB mode menu. The Windows USB controller reported healthy. The top case port is not proven faulty; check camera power, Webcam mode, a data-capable cable, and the port connection before changing software. Confirm the model and which computer it is connected to. Do not claim a working DJI preview until it is visible.

The house was later observed disarmed, with a camera-gone auto-end in its log. Check current status before testing; these notes are a dated observation, not a live status display.

## What each machine does

For the house feed: camera → UGREEN NAS relay → Spark OBS → UGREEN finished-program relay → Windows OBS → Whatnot. The Spark builds the finished picture, audio, camera cuts and fallback slates. Windows runs the Whatnot connection. The UGREEN relays and records; it is not the video compositor.

Larix phones publish SRT to the house relay. A DJI publishing through Mimo must use its configured house input. A DJI plugged into Windows in USB Webcam mode is a separate, direct camera path: it does **not** automatically pass through the Spark or inherit the house BRB, Privacy or camera switching. Establish which path is being tested before comparing delay.

The Spark can send the finished house program to YouTube and Facebook through separate destinations. On September 29 the owner API verified the YouTube channel as **Digital Gold Jelly Studio** (`UCd4bJKIvbGOIAT-GK4K-3_w`), not a separately verified Treasure Hauls YouTube channel. TikTok currently uses LIVE Studio on Windows. A running sender, an open application and a platform-confirmed public broadcast are different states.

## What the buttons do

| Control | Meaning |
| --- | --- |
| Arm house | Allows camera connections and prepares the house program; also starts selected, configured destinations. For rehearsal, leave all destinations off and LIVE Studio unchecked. |
| YouTube | Selects the YouTube sender. While armed, enabling it can immediately send video; YouTube's visibility and auto-start settings determine public availability. Verify the intended channel and visibility first. |
| Privacy | Replaces house camera/audio with the privacy slate. It does not make a platform's audience private and does not cover a direct USB camera in TikTok. |
| Hold to END STREAM | Ends the house pipeline and closes LIVE Studio. End the platform shows first. |
| Facebook LIVE | Creates an unpublished preview on the verified Page. Send house feed starts only the Facebook sender; publish separately in Live Producer when ready. |
| Show Assistant | Opens the single assistant for greetings, thank-yous and inventory answers. Preview does not post; Start assistant enables chat responses after a verified show connection. |
| Whatnot checklist | Explains how to connect the correct nightly show on Windows. Arming the house does not start a Whatnot show. |

When all house cameras disconnect for over five seconds, the Spark switches to BRB. A camera returning restores the picture. With another camera connected, the director can switch to it automatically. After all cameras are gone for 15 minutes, the house ends; the normal maximum session is eight hours. The user observed BRB preserve the downstream stream during a camera disconnect. Do not generalize this to a direct USB feed.

## Start the correct Whatnot show each night

1. Create or select the scheduled show in Whatnot Seller Hub. A show URL saved in the Tolley schedule is a link, not an OBS credential or a broadcast command.
2. On the stream page, arm the house with destinations off and LIVE Studio unchecked. Start the house camera. Confirm the Windows OBS **Program** scene has picture and a moving **House Program** audio meter.
3. Use [Chrome Remote Desktop](https://remotedesktop.google.com/access) to open the Windows stream PC. Open Chrome there, then Whatnot Seller Hub → Show OBS Tools.
4. Select the **Whatnot Live (Recommended)** profile in Windows OBS. Connect Show Tools to that OBS websocket immediately before the show. If requested, use the password from that Windows OBS instance, not the Spark's.
5. Select tonight's show and click **Start Show in Show Tools**. Whatnot supplies that show's changing stream credentials; there is no nightly stream key to paste into tolley.io/stream. Keep the tab open.
6. Confirm the show is actually live in Whatnot. Manage auctions and Whatnot chat there. End the show in Whatnot before ending the house.

If Whatnot requests an updated recommended profile, apply it while off-air, close and reopen Windows OBS, then reconnect Show Tools. Confirm the vertical canvas and WHIP service. A long-idle connection can require refreshing Show Tools and reconnecting. Do not restart OBS during a running show. These steps follow the [Whatnot OBS guide](https://help.whatnot.com/hc/en-us/articles/5497980244749-Using-OBS-with-your-Livestream).

The director's Whatnot “not configured” refers to its unused legacy RTMP destination; it cannot determine whether the Windows WHIP show is live. Never replace the current workflow with the legacy Whatnot key form.

## Single-camera picture, audio and delay test

1. Establish the route: house input with Spark processing, or DJI USB directly into Windows. First get the DJI recognized and its preview working. Do not run two capture applications against the same USB device unless sharing is verified.
2. Check picture and audio in the source preview. For the house path, also inspect the finished Windows OBS program. Keep playback speakers muted or use headphones to avoid echo.
3. Clap once on camera and say the time. Compare visible hand contact with the sound to check audio/video alignment. Do not change sync offsets merely because the whole stream arrives late.
4. With Jared's explicit readiness and the correct audience selected, start the chosen platform. Watch from a separate viewer device/account and measure the time between the real action and its appearance. OBS preview alone does not measure platform delay. Record the source-to-OBS delay and OBS-to-viewer delay separately; no delay value has been measured yet.
5. For a house-path rehearsal, briefly interrupt only that camera after confirming the test scope. Verify BRB, then reconnect and verify recovery. This is not applicable to a DJI source used directly in LIVE Studio.

Whatnot's seller account in its mobile app may act as a controller rather than showing the viewer video; use another viewer account for that measurement.

## TikTok: audio repaired, camera eligibility still blocked

Observed in LIVE Studio 1.36.6 on September 29: this account requires **one more LIVE Studio broadcast lasting at least 25 minutes** to unlock virtual-camera use. The app explicitly says mobile LIVE streams do not count and validation can take up to 48 hours. Recheck the account's current message; this is not a universal rule for every TikTok account.

The visible picture came from the **obs64.exe window-capture source**. The separate **Camera** source selected OBS Virtual Camera but had no available resolution. Seeing the captured OBS window did not satisfy TikTok's camera requirement. The earlier assumption that the red Camera label was harmless was incorrect.

For a qualifying hardware-camera broadcast, Windows must first detect an eligible physical camera and LIVE Studio must show it working. A USB DJI may provide that source once connected correctly. Neither its detection nor TikTok acceptance has been verified.

Visibility choices observed were Everyone, Friends, Select people and Super Fan. There was no verified Only me mode. An empty Select people list was not established as a usable private broadcast. Do not call it private or assume a private/practice session counts toward eligibility. Prior tests were left offline. Jared later said he may go public when ready, which is not permission to start immediately.

The working audio route for the **house/OBS feed** is Windows OBS monitoring → **CABLE Input (VB-Audio Virtual Cable)** → LIVE Studio microphone **CABLE Output (VB-Audio Virtual Cable)**. House Program uses **Monitor and Output**, unmuted. OBS Virtual Camera carries video; the cable supplies audio separately. The direct DJI test still needs its chosen microphone verified.

Troubleshooting evidence:

- The cable device initially reported error 10. Restarting its existing device nodes restored usable endpoints without installing drivers or rebooting. One duplicate node still showed an error; do not remove devices blindly.
- The saved OBS profile named CABLE Input, but the active monitoring output was still Default. In OBS Audio settings, selecting Default and **Apply**, then CABLE Input and **Apply**, corrected the active route. Merely reading the saved setting or switching away and back without applying was insufficient.
- LIVE Studio's CABLE Output meter then moved; a short local, unrecorded audio probe measured nonzero signal. Its extra Realtek desktop-speaker input was muted and audio monitoring left off to avoid duplicate sound.
- OBS was actively sending to Whatnot during this repair. No OBS reinstall, second OBS instance or public TikTok broadcast was needed.

## Larix subscriptions for later cameras

The current house SRT setup needs **Larix Broadcaster Premium**, not the NDI subscription. Premium removes the watermark and time limit. The official FAQ allows up to ten devices sharing one Apple ID or one Google account; iOS and Android purchases are separate. Use Restore purchases if an eligible device has not activated. Recheck current pricing and terms in the [Larix Premium FAQ](https://softvelum.com/larix/premium/).

## Facebook LIVE and combined chat

The Facebook destination and comments reader are installed on the Spark. The owner-only stream page has a **Facebook** panel. Facebook Page **1156652300855210**, currently **Ruthann’s Treasure Haul**, was reverified through the existing Page token on September 29. Reading its live-video list, video ownership and comments endpoint succeeded. Existing clip publishing is independent of this live sender.

An unpublished preview was created: **Treasure Hauls — house preview**, live-video ID **122117051781297240**. Meta returned `UNPUBLISHED`; the house and Facebook sender were left off. This is dated evidence: recheck `/status.facebook` before operating. The complete camera → Facebook picture/audio path and real viewer comments on both platforms still need an authorized live test. No public Facebook show was started during installation.

### Nightly Facebook workflow

**One-hold path (added September 30):** arm the house with destinations off, confirm the camera picture and audio, then in **Facebook** click **Picture and sound are good**, and hold **GO LIVE on Facebook** for one second. The panel shows “Going live on Facebook…” while the Spark creates or reuses its unpublished preview, starts the sender and waits for Facebook to report incoming video; it publishes automatically and flips to “Live on Facebook” once Meta reports `LIVE`. The background comments reader follows the live show; the control page links to Show Assistant for Whatnot. Finish with **End Facebook show** (ends the show on Facebook, then stops the sender). If a pasted Live Producer key is loaded, this path sets it aside and uses a Spark-made show, because Facebook only lets the Page token publish shows it can see. CLI: `stream facebook golive [title] --confirm-public`, `stream facebook end`.

**Preview-first path** (publish yourself in Live Producer):

1. In [stream controls](/stream), open **Facebook → Manual setup & details** and bind tonight's show one of two ways:
   - **Spark preview:** check the Page name, enter the title and click **Create Facebook preview**. An existing unpublished preview is reused; its title is retained.
   - **Live Producer stream key (added September 29):** in [Facebook Live Producer](https://www.facebook.com/live/producer/?page_id=1156652300855210) choose Go live → *Streaming software*, copy the Server URL and Stream key (and the backup key if shown), open **Manual setup & details** → **Paste stream key from Live Producer**, and click **Use this stream key**. The panel then shows **Stream key loaded** with the key's last characters and the video ID taken from the key; compare that tail with Live Producer. Meta does not show a Live Producer video to the Page token until it goes live, so the status stays “Stream key loaded” (phase `KEYED`) rather than “Unpublished preview” until then. After you go live in Live Producer, the panel can take up to a minute to notice (the Spark asks Meta about a hidden show once a minute because Meta throttles faster lookups). Facebook allows about four hours between the first preview and going live; if Live Producer resets the key, paste the new one. Stop the Facebook sender before changing keys.
   - “Select an existing Facebook show” by live-video ID still works for shows Meta can already list; IDs from other Pages are rejected, and a Live Producer show is not selectable this way before it is live.
2. **Arm house** with other destinations off and LIVE Studio unchecked. Start the camera and confirm the house preview/audio. Initial selections now default off.
3. Click **Send house feed to preview** (or **Send house feed to Live Producer** when a pasted key is loaded). Open [Facebook Live Producer](https://www.facebook.com/live/producer/?page_id=1156652300855210), choose the same Page and preview, and check picture and sound. The ingest credential stays on the Spark. A pasted key transits the owner-only website once and is never stored or shown there; nothing needs to be copied back out.
4. For this manual path, click **Go live in Facebook Live Producer** when Jared is ready for viewers. The separate hold-to-go-live path publishes from the website. The Facebook panel changes to “Live on Facebook” only after Meta reports `LIVE`. “Sending” alone is not live confirmation. An unpublished preview is not an audience privacy setting; the public show’s audience is controlled in Facebook.
5. The background reader continues collecting Facebook comments; the control page no longer displays combined chat. They follow the selected Facebook live-video ID and only read while Meta reports it live. If no author name is supplied, “Facebook viewer” is shown. Whatnot chat remains in Seller Hub. Stream Coach currently saves YouTube/TikTok only; Facebook comments are not added to Coach’s saved sessions yet.
6. End Facebook in Live Producer, then stop the Facebook sender or end the house after all platform shows have ended. Stopping video transport does not explicitly end the Facebook show.

The sender cannot start from a generic destination toggle or a remembered selection. A director restart disables Facebook sending but keeps the bound key or preview. With a pasted key, the Facebook status, LIVE badge and comments appear only once Meta reports the show live; when Live Producer ends the show, the sender stops on the next status check. CLI equivalent: `stream facebook key --stdin` (server, key, backup as lines) or `stream facebook key clear`; `stream facebook status` reports `ingest` (`manual`/`graph`) and the key tail. If an already-public show needs reconnecting, select its ID and use **Resume public Facebook feed**, which asks for explicit confirmation before forwarding picture/audio. The house’s BRB and Privacy slates are part of the same finished program sent to Facebook. Privacy is not a platform audience control.

### Recovery and validation

- Expired token: reconnect the exact Page in social settings; rerun `ops/stream/facebook/provision.mjs` with the production environment available privately. It checks the saved binding and `/me` identity and stores credentials only in the existing secure configuration. No camera or OBS passwords belong in documents or chat.
- Ambiguous preview request: creation intent is recorded before the API POST. Do not retry blindly or clear the guard. Open Live Producer, locate that preview and use its live-video ID to select it. Creating another preview does not automatically clear an uncertain previous attempt.
- Failed ownership/status checks disable forwarding. Facebook errors are displayed without returning upstream bodies or ingest credentials. FFmpeg’s Facebook output is not logged because an error can echo its ingest URL.
- The comments reader preserves its paging cursor across ordinary polling, retries from the last timestamp after a failed cursor request and suppresses replayed event IDs. Show changes clear old source messages. Chat service restarts send a new epoch so the browser cannot become stuck behind an old sequence number.
- Remaining live acceptance check: once Jared approves a public test, confirm the actual picture/audio in Facebook, send one viewer comment on Facebook and one on YouTube, verify both in the combined panel, then interrupt/reconnect the chat reader and confirm no duplicates. Do not send comments or replies as Jared without authorization.

Implementation, mocked contract tests, install and rollback instructions: `ops/stream/facebook/README.md`. All nine offline contract tests passed during installation; website browser checks are recorded in the validation handoff.

## Agent handoff and source of truth

Read `ops/stream/STREAM-AGENTS.md` or the installed `~/stream-director/agents/STREAM-AGENTS.md` before operations. Use `stream status` first and the director CLI for normal control. Live state is not persistent memory. Never copy camera keys, platform credentials or OBS websocket passwords into these notes.

This guide is the durable shared handoff. Keep it updated alongside the HQ link and stream-page directions. Today's source configuration repairs were explicitly authorized by Jared; they are not blanket permission for future agents to interrupt a live show, install software, or start a public broadcast.

## Windows OBS blank after the house reconnects

Observed September 29 after Facebook setup: the house was armed, camera 1 active and Spark encoding. Windows OBS had the correct Whatnot Live (Recommended) profile, Program scene and enabled House Program source, but source dimensions were 0×0, media cursor 0 and no RTSP relay connection. The media state misleadingly said PLAYING. The relay itself supplied 1080×1920 H.264 plus 48 kHz stereo AAC. Windows OBS was not broadcasting.

Jared explicitly authorized refreshing this Windows source while the house remained armed. TriggerMediaInputAction RESTART did not recover it. Reapplying only the existing House Program input address through SetInputSettings with overlay=true reopened its network connection, preserving all source settings. The current address was rtsp://192.168.2.196:8554/program. A Windows Program screenshot then showed the camera; source dimensions returned to 1080×1920, cursor advanced, and 99 meter samples had a nonzero audio peak (~0.219). House Program stayed unmuted at unity gain with Monitor and Output to CABLE Input. House and Facebook sender stayed running. No Whatnot/public broadcast was started.

For recurrence, inspect first: this is one observed stale connection, not proof that every black preview has this cause. While armed, obtain the specific Windows-source refresh authorization required by the hard rule; this prior approval applies to this repair only. Do not restart OBS, change profiles, stop the house, or start Whatnot just to refresh the input.


## One Show Assistant — September 29, version 1.56.2

Jared superseded the separate-version request: use **one Show Assistant** combining greetings, thank-you DMs, announcements and inventory answers. Open [Show Assistant](/stream/assistant) from the single button in [stream controls](/stream). Both historical URLs (`/api/stream/whatnot-bot/admin` and `/api/stream/whatnot-bot-v2/admin`) open the same upgraded worker; there is no version chooser. The previous worker is stopped and disabled, with source/database preserved for operator recovery. Existing settings, history, opt-outs and cooldowns carry forward. The upgraded worker remains paused until owner Start; installing it does not send messages or start video.

### Nightly assistant workflow

1. Open **Show Assistant** and try **Preview answer**. A preview never sends chat or DMs. Named-product follow-ups are remembered per viewer for five minutes.
2. Paste tonight's Whatnot link and **Connect show**. Existing visible chat becomes a baseline and is not replayed.
3. Optionally select and confirm a saved Tolley lineup for this show. Reconnecting clears this binding. Without a confirmed lineup, answers are qualified as catalog/backstock. This is not an automatic import of tonight's Whatnot auction list, and the assistant cannot see the item being held or hear the host.
4. Review settings and press **Start assistant** when ready. It requires verified live chat for treasure_hauls and a fresh inventory snapshot. **Pause assistant** stops responses without changing OBS or the broadcast.

Public messages: at least 60 seconds apart, at most 40 per rolling hour including announcements. Repeated greetings/saved FAQs wait five minutes per viewer; product follow-ups can use the next one-minute slot. Replies expire after two minutes. Thank-you DMs retain the 45-second default delay and 30-day recipient cooldown. Uncertain sends are not retried.

### Inventory and answer boundaries

The read-only minute export uses Tolley Product/PlatformListing records, including imported Facebook listings and Tolley draft records, plus saved StreamLineups. Initial snapshot: 1,906 records (54 listed, 624 drafts, 1,228 sold/unavailable), not a verified physical stock count. No Whatnot PlatformListing rows were present at implementation time. Auction-1 was a saved 12-item lineup dated September 27; never automatically call it tonight's show.

The existing local model selects catalog IDs, intent and literal facts; public text comes from bounded templates. Recorded titles, condition and verified descriptions can support answers. Unverified descriptions, internal purchase costs, minimum prices and private lineup notes are not exported. Sold/archived records override old active listings. Drafts need host confirmation; backstock is not promised in the show. Prices refer viewers to Whatnot/the host. Missing details, working-condition checks, compatibility and policy questions stay with the host. Inventory older than three minutes stops product answers; evidence is rechecked before sending.

A real preview matched the listed Fellow Stagg kettle and correctly held its missing condition for the host. Offline tests exercise the complete same-viewer named-product/condition follow-up, greeting restraint, sold changes, model constraints, owner/session checks and non-posting previews. A real viewer-chat acceptance test still awaits owner Start; do not enable the assistant automatically or claim that live test passed.

### Runtime and recovery for agents

Source: `ops/stream/assistant-v2/` (historical directory name). Runtime: `~/whatnot-inventory-bot`, loopback 8112, `tolley-inventory-assistant.service`. Catalog service/timer: `tolley-inventory-catalog`; state/snapshot under `~/.local/state/tolley-inventory-assistant/`. One-time migration copies Classic configuration and preserves both SQLite databases with timestamped backups. History and opt-outs are read across both stores. Classic `~/whatnot-admin-bot`, port 8111/service `tolley-whatnot-bot`, is retired; do not restart it while the upgraded sender is active. The upgraded worker fails closed if it detects the previous worker sending, or cannot verify its state. Connection refusal is expected for the retired worker.

The main and previous V2 proxy URLs both forward only to port 8112. Website controls require owner login/MFA, same-origin POST and CSRF checks. Installation requires an idle house and both assistants paused/not busy, then retires the old sender and starts the upgraded sender paused. See `ops/stream/assistant-v2/README.md` for recovery; rollback is an operator action, not a nightly version choice. Never print credentials or copy browser sessions.

## Stream controls redesign — September 30

The house status and Arm house control now appear first. Camera selection, YouTube and Now selling keep their existing behavior. Help & tools opens on hover, keyboard focus or tap for schedule, Coach, stock, setup guidance and the optional product display. House details contains diagnostics and the optional LIVE Studio launch checkbox. Whatnot startup instructions are collapsed under Whatnot setup.

Facebook shows one current step: arm the house, start the camera and check picture/audio in Windows OBS, then acknowledge the check and hold GO LIVE for one second. A lost house feed or changed show clears the acknowledgement. Publishing stays an explicit owner action. Manual preview/key setup is under Manual setup & details. A manual preview already sending directs the owner to publish in Live Producer. Sending alone never displays Live on Facebook.

The stream control page no longer displays or polls combined chat. Open Show Assistant for the existing Whatnot assistant; this does not add Facebook/YouTube chat to that assistant. The background chat reader and Stream Coach are unchanged.

## Show Assistant live repair — October 1

The owner requested starting the assistant during the live show. It initially ran, then an unavailable recipient inbox caused a thank-you DM timeout and paused the entire assistant. Promoted join rows also have a nested join message plus a separate “only visible to you” caption; the old chat parser treated that caption as viewer text and queued unwanted thank-you DMs.

The parser now reads the actual message before the caption, and join/caption text cannot trigger replies or DMs. A failed DM is recorded as uncertain without retry, disables further DMs, and leaves public replies running; live-account and freshness checks still pause all sends when necessary. Connect show now displays progress and its failure near the button. All 29 offline assistant tests passed.

Thank-you DMs were left disabled pending inbox repair; greetings, product replies and announcements remained enabled. This is a dated settings observation: inspect the live snapshot before changing them. An owner-authorized public welcome was recorded as sent and its host-chat echo verified. Assistant messages appear under the existing treasure_hauls account. A live inventory-answer acceptance test remains separate from this welcome check. Only the assistant worker was restarted; OBS, cameras and director were untouched.

### Reliability rollout after the show

The owner authorized implementing all diagnostic findings. The later failed monitor reply was 199 characters; Whatnot displayed a 150-character limit and retained the rejected text. Public replies now fit within 150 characters including mentions, preserve stock/condition qualifications, and hold facts that cannot fit. Known rejections recover without stopping public replies; uncertain deliveries are never retried. The dashboard shows separate public/DM status, last confirmed message, persistent pause/failure reasons and blocked drafts. An assistant-owned draft may be cleared explicitly without replay or automatic resume.

Clear catalog matches and broad ambiguous queries avoid model inference; shipping follow-ups are held for the host. Saved lineup review includes dates, items, quantities and sold/unavailable markers and requires explicit confirmation for the connected live show. The only saved Auction-1 lineup is not selected automatically. Use Create or edit a show lineup, then review and confirm it after connecting the next live show.

DM preparation now waits for the exact active recipient, recovers once from a stale inbox navigation, and handles composer hydration without submitting twice. A read-only check verified the t0ll3ytot3 recipient and a visible send control; its diagnostic draft was cleared and no DM sent. DMs were re-enabled in saved settings after this repair, while the assistant remained paused because the show had ended. Check current settings rather than treating this observation as an ongoing state.

All 39 assistant tests and both proxy checks passed. Production Samsung-monitor preview returned a 69-character clarification in 343 ms; shipping follow-up held in 20 ms. Mobile dashboard had no horizontal overflow or JavaScript errors. Both history databases and the runtime were backed up before replacing assistant files. No director, OBS or camera restart was needed. Live verification of the upgraded product replies and DMs remains for the next owner-started show.


## October 2 voice/video sync audit (after the show)

Jared reported hearing his voice before seeing his mouth move, near the start and in several recent replays. The microphone feeds the DJI. Tonight's relay log confirmed RTMP camera publishing from 192.168.2.77; the program publisher was Spark. NAS recordings contain Spark's finished program, recorded as fMP4 without a separate re-encode. The origin of the offset (DJI output versus Spark processing) has not been isolated with simultaneous source/program capture.

Read-only checks found Camera 1 was the only house microphone, audio sync 0 ms, no camera filters, and settings matching the September 18 saved backup. The Voice Fireworks file contains video only. Windows House Program also had sync 0 ms, the correct program relay, and no saved global audio inputs. Do not blame a separate desktop mic or change the Whatnot/VB-Cable routes from this evidence.

The long-running OBS log reported source-audio lag of 3919.61 ms and 4191.46 ms at the October 2 21:34 and 22:12 camera disconnects. Those warnings are not measurements of steady lip-sync offset and must not be used as a 4-second correction.

Offline SyncNet analysis of usable face tracks estimated audio ahead by 160 ms early, 280 ms mid-show, and 280 ms late. The tool reproduced its author's known reference offset and detected an exactly introduced 1000 ms audio delay. These remain software estimates, not a clap measurement. An additional short, obstructed late track had low confidence and was excluded; the sampled October 1 wide shot yielded no usable face track, so the older show's offset was not measured.

A separate 250 ms audio-delay test estimated residuals of -80 ms early, +40 ms mid-show, and 0 ms late (positive means audio ahead). While the house and OBS outputs were idle, Camera 1's existing audio sync setting was set to +250 ms and read back; CAM1_SYNC_MS=250 was saved only in the existing secure stream.env. Cameras 2–4 stayed at 0 ms. No OBS/director restart, stream key, encoder, scene, route, or platform setting was changed. Prior timing values and diagnostic estimates are recorded without credentials in ~/.local/state/tolley-stream-sync/oct2-correction.json.

Private live-feed acceptance is still pending. Before claiming show readiness, compare a visible clap in the direct DJI feed and the finished house recording with public destinations explicitly off, then confirm the viewer feed when Jared starts the show. A different camera/input mode needs its own timing check. The observed 160–280 ms range does not establish a full two-second mismatch throughout any recording or exclude additional playback delay; Jared's playback application and exact DJI model remain unconfirmed.

The NAS originals were preserved. Comparison clips are in /volume1/UserFolder/Jared/stream-recordings/sync-tests-oct2/; measured-250ms-middle.mp4 is the new quarter-second test. The earlier 1-second and 2-second clips were rejected by Jared and were never applied to the house. No historical full recordings were rewritten or replays published.


## October 3 DJI camera cutoff follow-up

Jared identified the camera as Osmo Action 6 and confirmed that the Continue prompt appears on the camera. Read-only NAS logs show the incoming RTMP publisher timed out at October 1 21:43:25 and October 2 21:34:15 / 22:12:01 (America/Chicago). New publisher connections restored the feed about 24–27 seconds later. Camera session intervals were approximately 75, 71 and 37 minutes, not a consistent one-hour interval. The director did not end the house at these interruptions; its fallback handled the missing camera. MediaMTX has readTimeout: 6s and writeTimeout: 10s. No cutoff-related camera, relay or OBS setting was changed.

The timeout establishes a stall in incoming data, not whether the root cause is camera heat/power, Wi-Fi or camera software. Jared subsequently confirmed battery-only operation with plenty of charge; USB charging is not involved, and low battery is less likely from his observation. Any warning preceding Continue remains unconfirmed. Do not label this a proven thermal shutdown, OBS cutoff or DJI one-hour limit. DJI's current Action 6 livestream guide lists 1080p at 3 or 6 Mbps; its screen-timeout guidance also covers livestream mode. Reviewed Action 6 firmware notes do not identify a specific fix for this failure. A private rehearsal of at least 90 minutes, with all public destinations explicitly off, should capture the camera's exact warning, power/battery state and network events at any recurrence; do not arm or publish automatically.

Official references: [DJI livestream parameters](https://repair.dji.com/help/content?customId=en-us03400006728&lang=en&paperDocType=paper&re=US&spaceId=34), [Action 6 screen timeout](https://repair.dji.com/help/content?customId=01700006930&lang=en&paperDocType=ARTICLE&re=US&spaceId=17), [Action 6 download center](https://www.dji.com/downloads/products/osmo-action-6).

## October 4 assistant connection and audio follow-up

Connect show can now attach the verified upcoming host show before it starts. It displays **Waiting for you to Start Show in Whatnot**, continues observing that show, and enables Start assistant after two fresh observations with an advancing live timer. Sending still requires the owner's Start. Wrong-account, ended and stale views stay blocked. All 42 assistant tests and both proxy checks passed. The three changed runtime files match the tested source; the paused worker was updated with a rollback copy under `~/.local/state/tolley-inventory-assistant/connection-backup-1791166812/`. No broadcast was started.

Jared reported worse audio sync in YouTube replay `OPjSI01M_tg`. The NAS program recording is `2026-10-05_01-18-31.mp4`. Matching picture and audio between the replay and NAS at three points found only 10–20 ms additional audio lead on YouTube, with audio correlation 0.98–0.997. This points upstream of YouTube; it does not isolate DJI output from Spark processing.

Camera 1's existing +250 ms delay was confirmed active. SyncNet estimates on early/middle/late face tracks measured remaining audio lead of 400/400/440 ms. Separate copies with an additional 400 ms audio delay measured residuals of 0/0/40 ms. These are software estimates rather than a physical clap measurement. During verified idle operation, Camera 1 was set to +650 ms, saved only as `CAM1_SYNC_MS=650` in the existing secure stream.env, and read back after reloading the idle director so its cached configuration cannot restore 250 ms on the next Arm house. OBS was not restarted, other camera offsets remained zero, and no public broadcast was started.

This compensation is installed; **live acceptance and the cause of the change between shows remain unresolved**. Jared was asked for readiness for a short private DJI clap test with all destinations off. Do not call the next show verified in sync until simultaneous camera/program capture confirms the correction. Do not automatically arm the house while awaiting readiness. Preserve recordings and do not apply another guessed delay.

The report is `~/.local/state/tolley-stream-sync/report-oct4.json`; previous/new timing values are in `oct4-correction.json`. Original and corrected comparison clips are in `/volume1/UserFolder/Jared/stream-recordings/sync-tests-oct4/`, with local copies under `~/Shared/streamer/sync-tests-oct4/`. The original replay and NAS program recording were not rewritten. Temporary analysis media was moved into memory after the system disk filled; no unrelated files were removed.

### Planned private test — Monday, October 5

Jared deferred the private audio test until tomorrow, October 5, 2026 (America/Chicago). The time is awaiting his answer; no timed reminder or Whatnot show has been created. The house is disarmed, all house destinations are off (including YouTube), and Camera 1's saved audio delay is 650 ms. Recheck these states tomorrow.

Create a new Whatnot show with Show Discoverability set to Private; keep its link between the test participants. With Jared ready, arm only with all house destinations off and LIVE Studio unchecked, then have him start the DJI. Start that private Whatnot show from Windows Show Tools. After Jared sends the link and says ready, begin simultaneous short captures of the raw camera and finished house feed before cueing three visible claps and 20 seconds of speech. Compare camera, house and platform timing; the purpose is both live acceptance and isolating the change between shows. End Whatnot first, then end the house when Jared is finished. Keep Show Assistant paused for this audio test unless he explicitly requests replies. No stream starts automatically tomorrow.
TOLLEY_OPERATIONS_md

cp "$HOME/stream-director/agents/STREAM-AGENTS.md" "$hub/STREAM-AGENTS.md"
cp "$HOME/stream-director/agents/OPERATIONS.md" "$hub/OPERATIONS.md"
touch "$HOME/.codex/AGENTS.md"
if ! grep -Fq '# Streams Mac mini identity and operating instructions' "$HOME/.codex/AGENTS.md"; then
  printf '\n' >> "$HOME/.codex/AGENTS.md"
  cat "$hub/AGENTS.md" >> "$HOME/.codex/AGENTS.md"
fi
{
  printf 'Role: Tolley primary operator hub\nUsername: %s\nHome: %s\n' "$(id -un)" "$HOME"
  printf 'Computer name: '; scutil --get ComputerName
  printf 'Local host name: '; scutil --get LocalHostName
  printf 'Architecture: '; uname -m
  printf 'macOS:\n'; sw_vers
  system_profiler SPHardwareDataType | awk '/Model Name:|Model Identifier:|Chip:|Processor Name:|Memory:/{print}'
  printf 'Expected Tailscale address: 100.96.109.9\nCurrent power settings:\n'
  pmset -g custom
  printf '\nMini public SSH key:\n'; cat "$mini_key.pub"
} > "$HOME/.config/tolley-hub/identity.txt"
cp "$HOME/.config/tolley-hub/identity.txt" "$hub/Identity.txt"
cp "$HOME/.config/tolley-hub/identity.txt" "$HOME/.config/tolley-hub/tolley-mac-mini-identity.txt"
cat > "$hub/Open Hub.command" <<'TOLLEY_OPEN'
#!/bin/bash
exec /usr/bin/open -a Safari "$HOME/Desktop/Tolley Hub/Hub.html" 'https://www.tolley.io/hq' 'https://www.tolley.io/stream/assistant'
TOLLEY_OPEN
cat > "$hub/Spark Terminal.command" <<'TOLLEY_SPARK_OPEN'
#!/bin/bash
exec "$HOME/bin/spark-terminal"
TOLLEY_SPARK_OPEN
cat > "$hub/Codex on Spark.command" <<'TOLLEY_CODEX_OPEN'
#!/bin/bash
exec "$HOME/bin/spark-codex"
TOLLEY_CODEX_OPEN
chmod 700 "$hub/"*.command
for spec in 'HQ|https://www.tolley.io/hq' 'Show Assistant|https://www.tolley.io/stream/assistant' 'Windows Remote Desktop|https://remotedesktop.google.com/access'; do
  label=${spec%%|*}; url=${spec#*|}
  printf '<?xml version="1.0"?><plist version="1.0"><dict><key>URL</key><string>%s</string></dict></plist>\n' "$url" > "$hub/$label.webloc"
done
for spec in 'NAS Shared Files|smb://192.168.2.196/UserFolder' 'NAS Personal Folder|smb://192.168.2.196/personal_folder' 'Share Mac mini Screen|vnc://100.96.109.9'; do
  label=${spec%%|*}; url=${spec#*|}
  printf '<?xml version="1.0"?><plist version="1.0"><dict><key>URL</key><string>%s</string></dict></plist>\n' "$url" > "$hub/$label.inetloc"
done
ts_bin=''
if command -v tailscale >/dev/null 2>&1; then ts_bin=$(command -v tailscale)
elif [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]; then ts_bin=/Applications/Tailscale.app/Contents/MacOS/Tailscale
fi
if [ -n "$ts_bin" ]; then
  if "$ts_bin" file cp "$HOME/.config/tolley-hub/tolley-mac-mini-identity.txt" 100.81.82.79:; then
    echo 'Public identity sent to Spark using Taildrop.'
  else
    echo 'Taildrop return was unavailable. Send the username below; the public key remains in Desktop/Tolley Hub/Identity.txt.'
  fi
fi
open 'x-apple.systempreferences:com.apple.Sharing-Settings.extension' || true
open -a Safari "$hub/Hub.html" || true
printf '\nSetup files installed. Your mini username is: %s\n' "$(id -un)"
printf 'In Sharing settings turn on Remote Login and Screen Sharing for your Mac user.\nTell the agent when Remote Login is on. Target SSH keys still need authorization.\n'
