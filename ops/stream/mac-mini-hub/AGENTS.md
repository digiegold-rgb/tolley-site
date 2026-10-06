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
