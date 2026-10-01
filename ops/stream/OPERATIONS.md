# Streaming operator guide

Updated September 30, 2026. Shared instructions for Jared and the agents maintaining Treasure Hauls. Available in HQ → Docs → Streaming & Show Assistant guide, and from the stream controls.

## Next show: quick start

There is **one Show Assistant** for viewer greetings, thank-you DMs, announcements and inventory answers. The old V1/V2 choice is retired; existing settings, message history, cooldowns and opt-outs are preserved. [Open Show Assistant](/stream/assistant) · [Open stream controls](/stream).

1. **Before going live:** open Show Assistant, check that inventory says **Fresh**, and try **Preview answer** with “Do you have any Stagg electric kettles?” Preview never posts. Try “What condition is it?” too; an unrecorded detail should be left for you rather than guessed.
2. **Prepare the picture and sound:** select the correct Whatnot show, arm the house with destinations off and LIVE Studio unchecked, start the house camera, and confirm picture plus moving audio in Windows OBS. Follow the Windows Whatnot steps below. A direct DJI USB feed is a different path; its detection remains unverified.
3. **Start the Whatnot show on Windows:** select **Whatnot Live (Recommended)** in OBS, connect the correct show through Whatnot Show Tools, then click **Start Show** when ready. Keep Show Tools open. Confirm the show is actually live before connecting the assistant.
4. **Connect the assistant:** paste that show's URL and click **Connect show**. Optionally confirm the correct saved Tolley lineup. Without a selected lineup, it can still answer catalog/backstock questions, with availability qualified. Review settings, then click **Start assistant** when you want replies.
5. **Check the first real interaction:** have a viewer send a new “Hi” after Start, then a named-product question. Public messages are at least 60 seconds apart and capped at 40/hour, so allow time. Old comments are not replayed. Review **Questions and decisions** to see an answer's evidence or why a question was held for you. The first live inventory-answer acceptance test is still pending; previews and automated tests have passed.
6. **When finished:** click **Pause assistant**, end the show in Whatnot, then end the house after all platform broadcasts have ended. Pausing the assistant does not stop the camera or broadcast.

If **Connect show** fails, confirm the show is live and the Spark's existing Chrome session is still signed in as `treasure_hauls`. The assistant uses that browser session; Windows Chrome/OBS handles the separate Whatnot video connection. Do not restart OBS or change stream keys to fix assistant chat.

## Daily drafts and automatic inventory refresh

The assistant reads the saved **Tolley inventory every minute**, throughout the day and overnight. Ruthann's new drafts entered through Tolley's listing tools become available on the next successful refresh; there is no nightly wait or manual model training. During the September 29 setup, 15 new Tolley drafts automatically appeared in the assistant (624 → 639 drafts), confirming this path was working. Those counts are dated records, not a current physical stock count.

**Unpublished drafts created only inside Facebook Marketplace are not automatically imported by the existing Facebook mirror.** That mirror handles published inventory/status changes. Confirm where Ruthann creates a draft before assuming it is covered. Once the item exists in Tolley, the assistant can pick it up automatically. New Facebook-only draft import has not been enabled.

Freshness describes the latest database snapshot, not a physical count of the shelves. Drafts remain unconfirmed stock; sold/archived records override old active listings. Inventory older than three minutes stops product answers until a fresh snapshot is available. Missing details, current auction pricing and physical condition checks stay with the host. Tonight's Whatnot auction list is not imported automatically: select a saved Tolley lineup explicitly if it applies.

## Camera and platform readiness


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
