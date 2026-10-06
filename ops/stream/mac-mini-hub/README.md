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
